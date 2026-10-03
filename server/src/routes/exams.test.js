import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import test from 'node:test'
import Category from '../models/Category.js'
import ExamAttempt from '../models/ExamAttempt.js'
import ExamRegistration from '../models/ExamRegistration.js'
import Exam from '../models/Exam.js'
import Question from '../models/Question.js'
import Quiz from '../models/Quiz.js'
import User from '../models/User.js'
import examRoutes from './exams.js'
import { getExamStatus, getRemainingSeconds, scoreExamAttempt } from '../examService.js'

test('exam lifecycle follows explicit state and configured time window', () => {
  const startTime = new Date('2026-10-03T10:00:00.000Z')
  const endTime = new Date('2026-10-03T11:00:00.000Z')
  const exam = { status: 'scheduled', startTime, endTime }
  assert.equal(getExamStatus(exam, new Date('2026-10-03T09:00:00.000Z')), 'scheduled')
  assert.equal(getExamStatus(exam, new Date('2026-10-03T10:30:00.000Z')), 'live')
  assert.equal(getExamStatus(exam, new Date('2026-10-03T11:00:00.000Z')), 'completed')
  assert.equal(getExamStatus({ ...exam, status: 'cancelled' }, new Date('2026-10-03T10:30:00.000Z')), 'cancelled')
})

test('exam scoring is server-side, one mark per correct response, with blanks counted separately', () => {
  const questions = [
    { question: 'q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
    { question: 'q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 2 },
    { question: 'q3', options: ['A', 'B', 'C', 'D'], correctAnswer: 0 },
  ]
  const result = scoreExamAttempt({
    questions,
    answers: [
      { question: 'q1', selectedOption: 'B' },
      { question: 'q2', selectedOption: 'A' },
    ],
    passingPercentage: 60,
    startedAt: new Date('2026-10-03T10:00:00.000Z'),
    submittedAt: new Date('2026-10-03T10:01:30.000Z'),
  })
  assert.deepEqual(result, {
    score: 1,
    totalMarks: 3,
    percentage: 33,
    correctAnswers: 1,
    wrongAnswers: 1,
    unanswered: 1,
    passed: false,
    timeTaken: 90,
  })
})

test('remaining time never drops below zero', () => {
  assert.equal(getRemainingSeconds(new Date('2026-10-03T10:00:00.000Z'), 1, new Date('2026-10-03T10:00:30.000Z')), 30)
  assert.equal(getRemainingSeconds(new Date('2026-10-03T10:00:00.000Z'), 1, new Date('2026-10-03T10:02:00.000Z')), 0)
  assert.equal(getRemainingSeconds(
    new Date('2026-10-03T10:00:00.000Z'),
    60,
    new Date('2026-10-03T10:10:00.000Z'),
    new Date('2026-10-03T10:15:00.000Z'),
  ), 300)
})

test('question bank endpoint requires authentication and administrator role and excludes answer keys', async () => {
  const previousSecret = process.env.JWT_SECRET
  const originals = {
    userFindById: User.findById,
    categoryFind: Category.find,
    quizFind: Quiz.find,
    questionFind: Question.find,
    examFind: Exam.find,
    examCount: Exam.countDocuments,
    registrationCount: ExamRegistration.countDocuments,
    registrationAggregate: ExamRegistration.aggregate,
    attemptCount: ExamAttempt.countDocuments,
    attemptAggregate: ExamAttempt.aggregate,
  }
  const secret = 'exam-route-test-secret'
  process.env.JWT_SECRET = secret
  const users = {
    '507f1f77bcf86cd799439011': { _id: '507f1f77bcf86cd799439011', name: 'Student', role: 'user' },
    '507f1f77bcf86cd799439012': { _id: '507f1f77bcf86cd799439012', name: 'Admin', role: 'admin' },
  }
  const category = {
    _id: '507f1f77bcf86cd799439021',
    name: 'JavaScript',
    slug: 'javascript',
    parentSlug: null,
    rootSlug: 'javascript',
  }
  const quizId = '507f1f77bcf86cd799439031'
  const questionId = '507f1f77bcf86cd799439041'
  User.findById = userId => ({ select: async () => users[String(userId)] })
  Category.find = () => ({
    select() { return this },
    sort() { return this },
    lean: async () => [category],
  })
  Quiz.find = () => ({
    select() { return this },
    populate() { return this },
    lean: async () => [{ _id: quizId, title: 'JavaScript Basics', difficulty: 'Easy', category }],
  })
  Question.find = () => ({
    select() { return this },
    sort() { return this },
    lean: async () => [{
      _id: questionId,
      quiz: quizId,
      text: 'Fixture prompt',
      options: ['One', 'Two', 'Three', 'Four'],
      correctAnswer: 2,
    }],
  })

  const app = express()
  app.use(express.json())
  app.use('/api/exams', examRoutes)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/exams`
  const studentToken = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, secret)
  const adminToken = jwt.sign({ sub: '507f1f77bcf86cd799439012' }, secret)

  try {
    const anonymous = await fetch(`${baseUrl}/question-bank`)
    assert.equal(anonymous.status, 401)
    const student = await fetch(`${baseUrl}/question-bank`, { headers: { authorization: `Bearer ${studentToken}` } })
    assert.equal(student.status, 403)
    const admin = await fetch(`${baseUrl}/question-bank`, { headers: { authorization: `Bearer ${adminToken}` } })
    assert.equal(admin.status, 200)
    const body = await admin.json()
    assert.equal(body.questions.length, 1)
    assert.equal(body.questions[0].id, questionId)
    assert.equal('correctAnswer' in body.questions[0], false)
  } finally {
    await new Promise(resolve => server.close(resolve))
    User.findById = originals.userFindById
    Category.find = originals.categoryFind
    Quiz.find = originals.quizFind
    Question.find = originals.questionFind
    Exam.find = originals.examFind
    Exam.countDocuments = originals.examCount
    ExamRegistration.countDocuments = originals.registrationCount
    ExamRegistration.aggregate = originals.registrationAggregate
    ExamAttempt.countDocuments = originals.attemptCount
    ExamAttempt.aggregate = originals.attemptAggregate
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('administrator can create a scheduled exam from existing question-bank references and publish it', async () => {
  const originals = {
    userFindById: User.findById,
    categoryFindById: Category.findById,
    categoryFind: Category.find,
    quizFind: Quiz.find,
    questionFind: Question.find,
    examCreate: Exam.create,
    examFindById: Exam.findById,
  }
  const secret = 'exam-create-test-secret'
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = secret
  const adminId = '507f1f77bcf86cd799439012'
  const subjectId = '507f1f77bcf86cd799439021'
  const quizId = '507f1f77bcf86cd799439031'
  const questionId = '507f1f77bcf86cd799439041'
  const category = { _id: subjectId, name: 'JavaScript', slug: 'javascript', rootSlug: 'javascript' }
  const sourceQuiz = { _id: quizId, difficulty: 'Easy', category: subjectId }
  const sourceQuestion = {
    _id: questionId, quiz: quizId, text: 'Fixture prompt',
    options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 2, explanation: 'Fixture explanation',
  }
  let created
  User.findById = userId => ({ select: async () => ({ _id: String(userId), role: 'admin', name: 'Admin' }) })
  Category.findById = () => ({ lean: async () => category })
  Category.find = () => ({ distinct: async () => [subjectId] })
  Quiz.find = () => ({ select() { return this }, lean: async () => [sourceQuiz] })
  Question.find = () => ({ select() { return this }, lean: async () => [sourceQuestion] })
  Exam.create = async data => {
    created = {
      ...data,
      _id: '507f1f77bcf86cd799439051',
      save: async function save() {},
      toObject() { return this },
    }
    return created
  }
  Exam.findById = () => created

  const app = express()
  app.use(express.json())
  app.use('/api/exams', examRoutes)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/exams`
  const token = jwt.sign({ sub: adminId }, secret)
  const startTime = new Date(Date.now() + 60_000)
  const endTime = new Date(Date.now() + 3_600_000)

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Fixture assessment',
        description: 'Test exam',
        instructions: 'Read each question carefully.',
        category: subjectId,
        topics: [],
        difficulty: 'Easy',
        questionCount: 1,
        duration: 30,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        passingPercentage: 60,
        maxAttempts: 2,
        status: 'scheduled',
        selectionMethod: 'manual',
        questionIds: [questionId],
      }),
    })
    assert.equal(response.status, 201)
    const body = await response.json()
    assert.equal(body.questions.length, 1)
    assert.equal(body.questions[0].question, questionId)
    assert.equal(created.questions[0], questionId)
    assert.equal(created.status, 'scheduled')
    assert.equal(created.questionSnapshots[0].correctAnswer, 2)

    const published = await fetch(`${baseUrl}/${created._id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(published.status, 200)
    assert.equal((await published.json()).status, 'scheduled')
  } finally {
    await new Promise(resolve => server.close(resolve))
    User.findById = originals.userFindById
    Category.findById = originals.categoryFindById
    Category.find = originals.categoryFind
    Quiz.find = originals.quizFind
    Question.find = originals.questionFind
    Exam.create = originals.examCreate
    Exam.findById = originals.examFindById
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('registered student can start, save, and submit one server-scored attempt without answer keys', async () => {
  const originals = {
    userFindById: User.findById,
    examFindById: Exam.findById,
    registrationUpdate: ExamRegistration.findOneAndUpdate,
    registrationFindOne: ExamRegistration.findOne,
    registrationExists: ExamRegistration.exists,
    attemptCount: ExamAttempt.countDocuments,
    attemptCreate: ExamAttempt.create,
    attemptFindOne: ExamAttempt.findOne,
    attemptFind: ExamAttempt.find,
  }
  const secret = 'exam-attempt-test-secret'
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = secret
  const studentId = '507f1f77bcf86cd799439011'
  const examId = '507f1f77bcf86cd799439051'
  const questionId = '507f1f77bcf86cd799439041'
  const now = new Date()
  let attemptsUsed = 0
  const exam = {
    _id: examId,
    title: 'Live assessment',
    category: { name: 'JavaScript', slug: 'javascript' },
    topics: [],
    difficulty: 'Easy',
    questionCount: 1,
    duration: 30,
    startTime: new Date(now.getTime() - 60_000),
    endTime: new Date(now.getTime() + 3_600_000),
    passingPercentage: 60,
    maxAttempts: 1,
    status: 'live',
    questionSnapshots: [{
      question: questionId,
      text: 'Fixture prompt',
      options: ['One', 'Two', 'Three', 'Four'],
      correctAnswer: 1,
      explanation: '',
    }],
  }
  let attempt
  User.findById = userId => ({ select: async () => ({ _id: String(userId), role: 'user', name: 'Student' }) })
  Exam.findById = () => ({ populate() { return this }, lean: async () => exam })
  ExamRegistration.findOneAndUpdate = async () => ({ registeredAt: now })
  ExamRegistration.findOne = async () => ({ exam: examId, student: studentId })
  ExamRegistration.exists = async () => true
  ExamAttempt.countDocuments = async () => attemptsUsed
  ExamAttempt.find = () => ({
    select() { return this },
    sort() { return this },
    lean: async () => [],
  })
  ExamAttempt.create = async data => {
    attemptsUsed += 1
    attempt = {
      ...data,
      _id: '507f1f77bcf86cd799439061',
      answers: [],
      save: async function save() {},
      toObject() { return this },
    }
    return attempt
  }
  ExamAttempt.findOne = async () => attempt

  const app = express()
  app.use(express.json())
  app.use('/api/exams', examRoutes)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/exams/${examId}`
  const token = jwt.sign({ sub: studentId }, secret)
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  try {
    const details = await fetch(baseUrl, { headers })
    assert.equal(details.status, 200)
    const detailBody = await details.json()
    assert.equal('questions' in detailBody, false)

    const registration = await fetch(`${baseUrl}/register`, { method: 'POST', headers })
    assert.equal(registration.status, 200)
    const start = await fetch(`${baseUrl}/attempt`, { method: 'POST', headers })
    assert.equal(start.status, 201)
    const started = await start.json()
    assert.equal(started.status, 'in-progress')
    assert.equal('correctAnswer' in started.questions[0], false)
    const extraAttempt = await fetch(`${baseUrl}/attempt`, { method: 'POST', headers })
    assert.equal(extraAttempt.status, 409)

    const saved = await fetch(`${baseUrl}/attempt/${attempt._id}/answers`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ answers: [{ questionId, selectedOption: 'Two', markedForReview: false }] }),
    })
    assert.equal(saved.status, 200)
    const submitted = await fetch(`${baseUrl}/attempt/${attempt._id}/submit`, { method: 'POST', headers })
    assert.equal(submitted.status, 200)
    const result = await submitted.json()
    assert.equal(result.score, 1)
    assert.equal(result.totalMarks, 1)
    assert.equal(result.percentage, 100)
    assert.equal(result.correctAnswers, 1)
    assert.equal(result.passed, true)

    const duplicateSubmit = await fetch(`${baseUrl}/attempt/${attempt._id}/submit`, { method: 'POST', headers })
    assert.equal(duplicateSubmit.status, 409)
  } finally {
    await new Promise(resolve => server.close(resolve))
    User.findById = originals.userFindById
    Exam.findById = originals.examFindById
    ExamRegistration.findOneAndUpdate = originals.registrationUpdate
    ExamRegistration.findOne = originals.registrationFindOne
    ExamRegistration.exists = originals.registrationExists
    ExamAttempt.countDocuments = originals.attemptCount
    ExamAttempt.create = originals.attemptCreate
    ExamAttempt.findOne = originals.attemptFindOne
    ExamAttempt.find = originals.attemptFind
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})

test('administrator results and analytics report participant and question performance', async () => {
  const originals = {
    userFindById: User.findById,
    examFindById: Exam.findById,
    registrationCount: ExamRegistration.countDocuments,
    attemptFind: ExamAttempt.find,
  }
  const secret = 'exam-analytics-test-secret'
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = secret
  const adminId = '507f1f77bcf86cd799439012'
  const examId = '507f1f77bcf86cd799439051'
  const studentId = '507f1f77bcf86cd799439011'
  const questionId = '507f1f77bcf86cd799439041'
  const attemptId = '507f1f77bcf86cd799439061'
  const exam = {
    _id: examId,
    title: 'Completed assessment',
    status: 'completed',
    startTime: new Date('2026-10-03T10:00:00.000Z'),
    endTime: new Date('2026-10-03T11:00:00.000Z'),
    duration: 30,
    passingPercentage: 60,
    questionSnapshots: [{
      question: questionId,
      text: 'Fixture prompt',
      options: ['One', 'Two', 'Three', 'Four'],
      correctAnswer: 1,
    }],
  }
  const completedAttempt = {
    _id: attemptId,
    exam: examId,
    student: { _id: studentId, name: 'Student', username: 'learner', email: 'learner@example.test' },
    attemptNumber: 1,
    status: 'completed',
    questionSnapshots: exam.questionSnapshots,
    answers: [{ question: questionId, selectedOption: 'Two' }],
    score: 1,
    totalMarks: 1,
    percentage: 100,
    correctAnswers: 1,
    wrongAnswers: 0,
    unanswered: 0,
    passed: true,
    startedAt: new Date('2026-10-03T10:00:00.000Z'),
    submittedAt: new Date('2026-10-03T10:01:00.000Z'),
    timeTaken: 60,
  }
  User.findById = userId => ({ select: async () => ({ _id: String(userId), role: 'admin', name: 'Admin' }) })
  Exam.findById = () => ({ populate() { return this }, lean: async () => exam })
  ExamRegistration.countDocuments = async () => 1
  ExamAttempt.find = () => ({
    populate() { return this },
    sort() { return this },
    lean: async () => [completedAttempt],
    then(resolve, reject) { return Promise.resolve([completedAttempt]).then(resolve, reject) },
  })

  const app = express()
  app.use('/api/exams', examRoutes)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/exams/${examId}`
  const token = jwt.sign({ sub: adminId }, secret)

  try {
    const resultsResponse = await fetch(`${baseUrl}/results`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(resultsResponse.status, 200)
    const results = await resultsResponse.json()
    assert.equal(results[0].student.name, 'Student')
    assert.equal(results[0].percentage, 100)
    assert.equal(results[0].attemptNumber, 1)

    const analyticsResponse = await fetch(`${baseUrl}/analytics`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(analyticsResponse.status, 200)
    const analytics = await analyticsResponse.json()
    assert.equal(analytics.totalParticipants, 1)
    assert.equal(analytics.attempted, 1)
    assert.equal(analytics.passed, 1)
    assert.equal(analytics.averageScore, 100)
    assert.equal(analytics.questionAccuracy[0].accuracy, 100)
  } finally {
    await new Promise(resolve => server.close(resolve))
    User.findById = originals.userFindById
    Exam.findById = originals.examFindById
    ExamRegistration.countDocuments = originals.registrationCount
    ExamAttempt.find = originals.attemptFind
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})
