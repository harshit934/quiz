import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import Exam from '../models/Exam.js'
import ExamAttempt from '../models/ExamAttempt.js'
import ExamRegistration from '../models/ExamRegistration.js'
import Category from '../models/Category.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { getExamStatus, getRemainingSeconds, scoreExamAttempt } from '../examService.js'

const router = Router()
const objectId = z.string().regex(/^[a-f\d]{24}$/i)
const examInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  instructions: z.string().trim().max(5000).default(''),
  category: objectId,
  topics: z.array(objectId).max(100).default([]),
  difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Mixed']),
  questionCount: z.number().int().min(1).max(200),
  duration: z.number().int().min(1).max(600),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  passingPercentage: z.number().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(20),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  selectionMethod: z.enum(['manual', 'random']),
  questionIds: z.array(objectId).max(200).default([]),
})
const answerInput = z.object({
  answers: z.array(z.object({
    questionId: objectId,
    selectedOption: z.string().max(180).default(''),
    markedForReview: z.boolean().default(false),
  })).max(200),
})

function id(value) {
  return String(value?._id ?? value)
}

function publicQuestion(question) {
  return {
    id: id(question.question),
    text: question.text,
    options: question.options,
  }
}

function examView(exam, { includeKeys = false, registration = null, attempts = [], canEdit = null } = {}) {
  const view = {
    _id: id(exam),
    title: exam.title,
    description: exam.description,
    instructions: exam.instructions,
    category: exam.category,
    topics: exam.topics,
    difficulty: exam.difficulty,
    questionCount: exam.questionCount,
    duration: exam.duration,
    startTime: exam.startTime,
    endTime: exam.endTime,
    passingPercentage: exam.passingPercentage,
    maxAttempts: exam.maxAttempts,
    status: getExamStatus(exam),
    selectionMethod: exam.selectionMethod,
    registration,
    attempts,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  }
  if (includeKeys) view.questions = exam.questionSnapshots
  if (canEdit !== null) view.canEdit = canEdit
  return view
}

function attemptView(attempt, exam, { includeKeys = false } = {}) {
  return {
    _id: id(attempt),
    exam: id(attempt.exam),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    questions: (attempt.questionSnapshots || []).map(question => includeKeys ? question : publicQuestion(question)),
    answers: (attempt.answers || []).map(answer => ({
      questionId: id(answer.question),
      selectedOption: answer.selectedOption,
      markedForReview: answer.markedForReview,
    })),
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    correctAnswers: attempt.correctAnswers,
    wrongAnswers: attempt.wrongAnswers,
    unanswered: attempt.unanswered,
    passed: attempt.passed,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeTaken: attempt.timeTaken,
    remainingSeconds: attempt.status === 'in-progress'
      ? getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime)
      : 0,
  }
}

function attemptDeadline(attempt, exam) {
  const durationEnd = new Date(attempt.startedAt.getTime() + exam.duration * 60000)
  return exam.endTime < durationEnd ? exam.endTime : durationEnd
}

async function findExam(examId) {
  if (!mongoose.isValidObjectId(examId)) return null
  return Exam.findById(examId).populate('category', 'name slug parentSlug rootSlug')
    .populate('topics', 'name slug parentSlug rootSlug').lean()
}

async function completeAttempt(attempt, exam, status = 'completed', submittedAt = new Date()) {
  if (attempt.status !== 'in-progress') return attempt
  Object.assign(attempt, scoreExamAttempt({
    questions: attempt.questionSnapshots,
    answers: attempt.answers,
    passingPercentage: exam.passingPercentage,
    startedAt: attempt.startedAt,
    submittedAt,
    maxTimeSeconds: getRemainingSeconds(attempt.startedAt, exam.duration, attempt.startedAt, exam.endTime),
  }), {
    status,
    submittedAt,
  })
  await attempt.save()
  return attempt
}

async function expireDueAttempts(exam) {
  const activeAttempts = await ExamAttempt.find({ exam: exam._id, status: 'in-progress' })
  for (const attempt of activeAttempts) {
    if (getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime) === 0) {
      await completeAttempt(attempt, exam, 'expired', attemptDeadline(attempt, exam))
    }
  }
}

async function assertEditable(exam) {
  const [registrations, attempts] = await Promise.all([
    ExamRegistration.countDocuments({ exam: exam._id }),
    ExamAttempt.countDocuments({ exam: exam._id }),
  ])
  if (registrations || attempts) {
    const error = new Error('An exam cannot be changed after students register.')
    error.status = 409
    throw error
  }
}

async function buildQuestionSelection(input) {
  if (input.startTime >= input.endTime) {
    const error = new Error('The exam end time must be after its start time.')
    error.status = 400
    throw error
  }

  const [category, topics] = await Promise.all([
    Category.findById(input.category).lean(),
    input.topics.length ? Category.find({ _id: { $in: input.topics } }).lean() : [],
  ])
  if (!category) {
    const error = new Error('Select a valid subject.')
    error.status = 400
    throw error
  }
  const rootSlug = category.rootSlug || category.slug
  if (topics.length !== input.topics.length || topics.some(topic => (topic.rootSlug || topic.slug) !== rootSlug)) {
    const error = new Error('Selected topics must belong to the chosen subject.')
    error.status = 400
    throw error
  }
  const topicFilter = topics.length
    ? { _id: { $in: topics.map(topic => topic._id) } }
    : { $or: [{ rootSlug }, { slug: rootSlug }] }
  const eligibleQuizzes = await Quiz.find({
    difficulty: input.difficulty === 'Mixed' ? { $in: ['Easy', 'Medium', 'Hard'] } : input.difficulty,
    category: { $in: await Category.find(topicFilter).distinct('_id') },
  }).select('_id difficulty category').lean()
  const quizById = new Map(eligibleQuizzes.map(quiz => [id(quiz), quiz]))
  const allQuestions = await Question.find({ quiz: { $in: eligibleQuizzes.map(quiz => quiz._id) } })
    .select('_id quiz text options correctAnswer explanation')
    .lean()

  let chosen
  if (input.selectionMethod === 'manual') {
    if (input.questionIds.length !== input.questionCount
      || new Set(input.questionIds).size !== input.questionIds.length) {
      const error = new Error('Select exactly the requested number of distinct questions.')
      error.status = 400
      throw error
    }
    const candidates = new Map(allQuestions.map(question => [id(question), question]))
    chosen = input.questionIds.map(questionId => candidates.get(questionId))
    if (chosen.some(question => !question)) {
      const error = new Error('Every selected question must belong to the chosen subject, topic, and difficulty.')
      error.status = 400
      throw error
    }
  } else {
    if (allQuestions.length < input.questionCount) {
      const error = new Error(`Only ${allQuestions.length} eligible question(s) are available.`)
      error.status = 400
      throw error
    }
    chosen = [...allQuestions]
    for (let index = chosen.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[chosen[index], chosen[swap]] = [chosen[swap], chosen[index]]
    }
    chosen = chosen.slice(0, input.questionCount)
  }

  const snapshots = chosen.map(question => {
    const sourceQuiz = quizById.get(id(question.quiz))
    return {
      question: question._id,
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      sourceDifficulty: sourceQuiz.difficulty,
    }
  })
  return { questions: chosen.map(question => question._id), questionSnapshots: snapshots }
}

router.use(authenticate)

router.get('/question-bank', requireAdmin, asyncHandler(async (req, res) => {
  const [categories, quizzes] = await Promise.all([
    Category.find().select('_id name slug parentSlug rootSlug').sort({ name: 1 }).lean(),
    Quiz.find().select('_id title difficulty category').populate('category', 'name slug parentSlug rootSlug').lean(),
  ])
  const quizById = new Map(quizzes.map(quiz => [id(quiz), quiz]))
  const questions = await Question.find({ quiz: { $in: quizzes.map(quiz => quiz._id) } })
    .select('_id quiz text options position').sort({ position: 1, _id: 1 }).lean()
  res.json({
    categories,
    questions: questions.flatMap(question => {
      const quiz = quizById.get(id(question.quiz))
      if (!quiz?.category) return []
      return [{
        id: id(question),
        text: question.text,
        options: question.options,
        quizTitle: quiz.title,
        difficulty: quiz.difficulty,
        category: quiz.category,
      }]
    }),
  })
}))

router.get('/admin/overview', requireAdmin, asyncHandler(async (req, res) => {
  const [exams, registrations] = await Promise.all([
    Exam.find().sort({ createdAt: -1 }).limit(10).populate('category', 'name').lean(),
    ExamRegistration.aggregate([{ $group: { _id: '$exam', count: { $sum: 1 } } }]),
  ])
  const registrationsByExam = new Map(registrations.map(item => [String(item._id), item.count]))
  const counts = { total: 0, draft: 0, scheduled: 0, live: 0, completed: 0, cancelled: 0 }
  const allStatuses = await Exam.find().select('status startTime endTime').lean()
  for (const exam of allStatuses) {
    const status = getExamStatus(exam)
    counts.total += 1
    if (Object.hasOwn(counts, status)) counts[status] += 1
  }
  res.json({
    counts,
    totalParticipants: await ExamRegistration.countDocuments(),
    totalAttempts: await ExamAttempt.countDocuments(),
    recentExams: exams.map(exam => ({
      _id: id(exam),
      title: exam.title,
      status: getExamStatus(exam),
      startTime: exam.startTime,
      category: exam.category?.name || '',
      participants: registrationsByExam.get(id(exam)) || 0,
    })),
  })
}))

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date()
  const registrationList = req.user.role === 'admin'
    ? []
    : await ExamRegistration.find({ student: req.user._id }).select('exam').lean()
  const registeredExamIds = registrationList.map(registration => registration.exam)
  const query = req.user.role === 'admin'
    ? {}
    : { $or: [
      { status: { $in: ['published', 'scheduled', 'live'] }, endTime: { $gt: now } },
      { _id: { $in: registeredExamIds } },
    ] }
  const exams = await Exam.find(query).sort({ startTime: 1, createdAt: -1 })
    .populate('category', 'name slug').populate('topics', 'name slug').lean()
  const examIds = exams.map(exam => exam._id)
  const registrations = await ExamRegistration.find({ exam: { $in: examIds }, student: req.user._id }).lean()
  const registeredIds = new Set(registrations.map(item => String(item.exam)))
  const userAttempts = await ExamAttempt.find({ exam: { $in: examIds }, student: req.user._id })
    .select('exam attemptNumber status percentage passed startedAt submittedAt').sort({ attemptNumber: 1 }).lean()
  const attemptsByExam = new Map()
  for (const attempt of userAttempts) {
    const list = attemptsByExam.get(String(attempt.exam)) || []
    list.push(attempt)
    attemptsByExam.set(String(attempt.exam), list)
  }
  res.json(exams.filter(exam => req.user.role === 'admin'
    || (!['draft', 'cancelled'].includes(getExamStatus(exam))
      && (getExamStatus(exam) !== 'completed' || registeredIds.has(id(exam)))))
    .map(exam => examView(exam, {
      registration: registeredIds.has(id(exam)),
      attempts: attemptsByExam.get(id(exam)) || [],
    })))
}))

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const input = examInput.parse(req.body)
  const selection = await buildQuestionSelection(input)
  const exam = await Exam.create({
    ...input,
    questions: selection.questions,
    questionSnapshots: selection.questionSnapshots,
    status: input.status || 'draft',
    createdBy: req.user._id,
  })
  res.status(201).json(examView(exam.toObject(), { includeKeys: true }))
}))

router.get('/:id/participants', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const registrations = await ExamRegistration.find({ exam: exam._id }).populate('student', 'name username email').sort({ registeredAt: 1 }).lean()
  const attempts = await ExamAttempt.find({ exam: exam._id }).sort({ attemptNumber: 1 })
  for (const attempt of attempts) {
    if (attempt.status === 'in-progress' && getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime) === 0) {
      await completeAttempt(attempt, exam, 'expired', attemptDeadline(attempt, exam))
    }
  }
  const attemptsByStudent = new Map()
  for (const attempt of attempts) {
    const list = attemptsByStudent.get(id(attempt.student)) || []
    list.push(attempt)
    attemptsByStudent.set(id(attempt.student), list)
  }
  res.json(registrations.filter(item => item.student).map(item => {
    const participantAttempts = attemptsByStudent.get(id(item.student)) || []
    const latest = participantAttempts.at(-1) || null
    return {
      student: { id: id(item.student), name: item.student.name, username: item.student.username || '', email: item.student.email },
      registeredAt: item.registeredAt,
      status: latest?.status || 'not-started',
      attemptsUsed: participantAttempts.length,
      latestAttempt: latest && {
        ...latest,
        remainingSeconds: latest.status === 'in-progress'
          ? getRemainingSeconds(latest.startedAt, exam.duration, new Date(), exam.endTime)
          : 0,
      },
      attempts: participantAttempts,
    }
  }))
}))

router.get('/:id/results', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  await expireDueAttempts(exam)
  const attempts = await ExamAttempt.find({ exam: exam._id, status: { $in: ['completed', 'expired'] } })
    .populate('student', 'name username email').sort({ submittedAt: -1 }).lean()
  res.json(attempts.filter(attempt => attempt.student).map(attempt => ({
    id: id(attempt),
    student: { id: id(attempt.student), name: attempt.student.name, username: attempt.student.username || '', email: attempt.student.email },
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    correctAnswers: attempt.correctAnswers,
    wrongAnswers: attempt.wrongAnswers,
    unanswered: attempt.unanswered,
    timeTaken: attempt.timeTaken,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
  })))
}))

router.get('/:id/analytics', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  await expireDueAttempts(exam)
  const [registrations, attempts] = await Promise.all([
    ExamRegistration.countDocuments({ exam: exam._id }),
    ExamAttempt.find({ exam: exam._id, status: { $in: ['completed', 'expired'] } }).lean(),
  ])
  const percentages = attempts.map(attempt => attempt.percentage)
  const timeTaken = attempts.map(attempt => attempt.timeTaken)
  const attemptedStudents = new Set(attempts.map(attempt => id(attempt.student)))
  const questionStats = new Map(exam.questionSnapshots.map(question => [id(question.question), {
    questionId: id(question.question),
    text: question.text,
    attempted: 0,
    correct: 0,
  }]))
  for (const attempt of attempts) {
    const answers = new Map(attempt.answers.map(answer => [id(answer.question), answer.selectedOption]))
    for (const question of attempt.questionSnapshots) {
      const stat = questionStats.get(id(question.question))
      if (!stat) continue
      const selected = answers.get(id(question.question))
      if (!selected) continue
      stat.attempted += 1
      if (selected === question.options[question.correctAnswer]) stat.correct += 1
    }
  }
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const passed = attempts.filter(attempt => attempt.passed).length
  res.json({
    totalParticipants: registrations,
    attempted: attemptedStudents.size,
    completed: attempts.length,
    passed,
    failed: attempts.length - passed,
    passPercentage: attempts.length ? Math.round(passed / attempts.length * 100) : 0,
    averageScore: Math.round(average(percentages)),
    highestScore: percentages.length ? Math.max(...percentages) : 0,
    lowestScore: percentages.length ? Math.min(...percentages) : 0,
    averageCompletionTime: Math.round(average(timeTaken)),
    questionAccuracy: [...questionStats.values()].map(item => ({
      ...item,
      accuracy: item.attempted ? Math.round(item.correct / item.attempted * 100) : 0,
    })),
  })
}))

router.get('/:id/attempt/:attemptId', asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const attempt = await ExamAttempt.findOne({ _id: req.params.attemptId, exam: exam._id })
  if (!attempt || (req.user.role !== 'admin' && id(attempt.student) !== id(req.user))) {
    return res.status(404).json({ message: 'Exam attempt not found.' })
  }
  if (attempt.status === 'in-progress' && getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime) === 0) {
    await completeAttempt(attempt, exam, 'expired', attemptDeadline(attempt, exam))
  }
  res.json(attemptView(attempt, exam, { includeKeys: attempt.status !== 'in-progress' && req.user.role === 'admin' }))
}))

router.post('/:id/register', asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ message: 'Only students can register for exams.' })
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const status = getExamStatus(exam)
  if (!['published', 'scheduled', 'live'].includes(status) || new Date(exam.endTime) <= new Date()) {
    return res.status(409).json({ message: 'Registration for this exam is closed.' })
  }
  const attemptsUsed = await ExamAttempt.countDocuments({ exam: exam._id, student: req.user._id })
  if (attemptsUsed >= exam.maxAttempts) {
    return res.status(409).json({ message: 'You have used all allowed attempts.' })
  }
  const registration = await ExamRegistration.findOneAndUpdate(
    { exam: exam._id, student: req.user._id },
    { $setOnInsert: { exam: exam._id, student: req.user._id, registeredAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.status(200).json({ registered: true, registeredAt: registration.registeredAt })
}))

router.post('/:id/attempt', asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ message: 'Only students can start exam attempts.' })
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const now = new Date()
  if (getExamStatus(exam) !== 'live' || now < new Date(exam.startTime) || now >= new Date(exam.endTime)) {
    return res.status(409).json({ message: 'This exam is not currently open.' })
  }
  const registration = await ExamRegistration.findOne({ exam: exam._id, student: req.user._id })
  if (!registration) return res.status(403).json({ message: 'Register for this exam before starting an attempt.' })
  const activeAttempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id, status: 'in-progress' })
  if (activeAttempt && getRemainingSeconds(activeAttempt.startedAt, exam.duration, now, exam.endTime) > 0) {
    return res.status(409).json({ message: 'Continue your active attempt instead of starting another.' })
  }
  if (activeAttempt) await completeAttempt(activeAttempt, exam, 'expired', attemptDeadline(activeAttempt, exam))
  const attemptsUsed = await ExamAttempt.countDocuments({ exam: exam._id, student: req.user._id })
  if (attemptsUsed >= exam.maxAttempts) return res.status(409).json({ message: 'You have used all allowed attempts.' })
  const attempt = await ExamAttempt.create({
    exam: exam._id,
    student: req.user._id,
    attemptNumber: attemptsUsed + 1,
    status: 'in-progress',
    questionSnapshots: exam.questionSnapshots.map(question => ({
      question: question.question,
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    })),
    totalMarks: exam.questionCount,
    startedAt: now,
  })
  res.status(201).json(attemptView(attempt.toObject(), exam))
}))

router.put('/:id/attempt/:attemptId/answers', asyncHandler(async (req, res) => {
  const input = answerInput.parse(req.body)
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const attempt = await ExamAttempt.findOne({ _id: req.params.attemptId, exam: exam._id })
  if (!attempt || (req.user.role !== 'admin' && id(attempt.student) !== id(req.user))) {
    return res.status(404).json({ message: 'Exam attempt not found.' })
  }
  if (req.user.role === 'admin') return res.status(403).json({ message: 'Administrators cannot answer student attempts.' })
  if (attempt.status !== 'in-progress') return res.status(409).json({ message: 'This attempt has already been submitted.' })
  if (getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime) === 0) {
    await completeAttempt(attempt, exam, 'expired', attemptDeadline(attempt, exam))
    return res.json(attemptView(attempt, exam))
  }
  const questionById = new Map(attempt.questionSnapshots.map(question => [id(question.question), question]))
  const seen = new Set()
  for (const answer of input.answers) {
    const question = questionById.get(answer.questionId)
    if (!question || seen.has(answer.questionId)) {
      return res.status(400).json({ message: 'Submitted answers contain an invalid or duplicate question.' })
    }
    if (answer.selectedOption && !question.options.includes(answer.selectedOption)) {
      return res.status(400).json({ message: 'Choose one of the available options.' })
    }
    seen.add(answer.questionId)
  }
  attempt.answers = input.answers.map(answer => ({
    question: answer.questionId,
    selectedOption: answer.selectedOption,
    markedForReview: answer.markedForReview,
  }))
  await attempt.save()
  res.json(attemptView(attempt, exam))
}))

router.post('/:id/attempt/:attemptId/submit', asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const attempt = await ExamAttempt.findOne({ _id: req.params.attemptId, exam: exam._id })
  if (!attempt || (req.user.role !== 'admin' && id(attempt.student) !== id(req.user))) {
    return res.status(404).json({ message: 'Exam attempt not found.' })
  }
  if (req.user.role === 'admin') return res.status(403).json({ message: 'Administrators cannot submit student attempts.' })
  if (attempt.status !== 'in-progress') return res.status(409).json({ message: 'This attempt has already been submitted.' })
  const expired = getRemainingSeconds(attempt.startedAt, exam.duration, new Date(), exam.endTime) === 0
  const submittedAt = expired ? attemptDeadline(attempt, exam) : new Date()
  await completeAttempt(attempt, exam, expired ? 'expired' : 'completed', submittedAt)
  res.json(attemptView(attempt, exam))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const exam = await findExam(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const status = getExamStatus(exam)
  const registration = req.user.role === 'admin'
    ? null
    : Boolean(await ExamRegistration.exists({ exam: exam._id, student: req.user._id }))
  if (req.user.role !== 'admin' && (['draft', 'cancelled'].includes(status) || (status === 'completed' && !registration))) {
    return res.status(404).json({ message: 'Exam not found.' })
  }
  const attempts = req.user.role === 'admin' ? [] : await ExamAttempt.find({ exam: exam._id, student: req.user._id })
    .select('attemptNumber status percentage passed startedAt submittedAt').sort({ attemptNumber: 1 }).lean()
  let canEdit = null
  if (req.user.role === 'admin') {
    const [registrations, examAttempts] = await Promise.all([
      ExamRegistration.countDocuments({ exam: exam._id }),
      ExamAttempt.countDocuments({ exam: exam._id }),
    ])
    canEdit = !registrations && !examAttempts && ['draft', 'scheduled', 'published'].includes(exam.status)
  }
  res.json(examView(exam, {
    includeKeys: req.user.role === 'admin',
    registration,
    attempts,
    canEdit,
  }))
}))

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const input = examInput.parse(req.body)
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['draft', 'scheduled', 'published'].includes(exam.status)) {
    return res.status(409).json({ message: 'Only inactive exams can be edited.' })
  }
  await assertEditable(exam)
  const selection = await buildQuestionSelection(input)
  const currentStatus = exam.status
  Object.assign(exam, input, selection, { status: currentStatus })
  await exam.save()
  res.json(examView(exam.toObject(), { includeKeys: true }))
}))

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['draft', 'scheduled', 'published'].includes(exam.status)) {
    return res.status(409).json({ message: 'Only inactive exams can be deleted.' })
  }
  await assertEditable(exam)
  await Exam.findByIdAndDelete(exam._id)
  res.json({ deleted: true })
}))

router.post('/:id/publish', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['draft', 'scheduled'].includes(exam.status)) return res.status(409).json({ message: 'This exam cannot be published in its current state.' })
  exam.status = exam.startTime > new Date() ? 'scheduled' : 'published'
  await exam.save()
  res.json({ id: id(exam), status: getExamStatus(exam) })
}))

router.post('/:id/unpublish', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['published', 'scheduled'].includes(exam.status)) return res.status(409).json({ message: 'This exam cannot be unpublished in its current state.' })
  await assertEditable(exam)
  exam.status = 'draft'
  await exam.save()
  res.json({ id: id(exam), status: exam.status })
}))

router.post('/:id/schedule', requireAdmin, asyncHandler(async (req, res) => {
  const scheduleInput = z.object({ startTime: z.coerce.date(), endTime: z.coerce.date() }).parse(req.body)
  if (scheduleInput.startTime >= scheduleInput.endTime || scheduleInput.endTime <= new Date()) {
    return res.status(400).json({ message: 'Provide a future end time after the start time.' })
  }
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['draft', 'scheduled'].includes(exam.status)) return res.status(409).json({ message: 'This exam cannot be scheduled in its current state.' })
  await assertEditable(exam)
  exam.startTime = scheduleInput.startTime
  exam.endTime = scheduleInput.endTime
  exam.status = 'scheduled'
  await exam.save()
  res.json({ id: id(exam), status: exam.status, startTime: exam.startTime, endTime: exam.endTime })
}))

router.post('/:id/start', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  const now = new Date()
  if (!['published', 'scheduled', 'live'].includes(exam.status) || now < exam.startTime || now >= exam.endTime) {
    return res.status(409).json({ message: 'The exam is outside its configured start/end window.' })
  }
  exam.status = 'live'
  await exam.save()
  res.json({ id: id(exam), status: exam.status })
}))

router.post('/:id/end', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (!['published', 'scheduled', 'live'].includes(exam.status)) return res.status(409).json({ message: 'This exam cannot be ended in its current state.' })
  const now = new Date()
  exam.endTime = now
  exam.status = 'completed'
  await exam.save()
  const activeAttempts = await ExamAttempt.find({ exam: exam._id, status: 'in-progress' })
  await Promise.all(activeAttempts.map(attempt => completeAttempt(attempt, exam, 'expired', now)))
  res.json({ id: id(exam), status: exam.status, endedAt: now })
}))

router.post('/:id/cancel', requireAdmin, asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
  if (!exam) return res.status(404).json({ message: 'Exam not found.' })
  if (['completed', 'cancelled'].includes(exam.status)) return res.status(409).json({ message: 'This exam cannot be cancelled in its current state.' })
  exam.status = 'cancelled'
  await exam.save()
  const activeAttempts = await ExamAttempt.find({ exam: exam._id, status: 'in-progress' })
  await Promise.all(activeAttempts.map(attempt => completeAttempt(attempt, exam, 'expired')))
  res.json({ id: id(exam), status: exam.status })
}))

export default router
