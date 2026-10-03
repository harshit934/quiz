import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import test from 'node:test'
import User from '../models/User.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import Attempt from '../models/Attempt.js'
import adminRoutes, { createReviewedQuestionMigrationHandler } from './admin.js'
import authRoutes from './auth.js'
import categoryRoutes from './categories.js'
import quizRoutes from './quizzes.js'
import { isQuizQuestionMigrationModeEnabled, shouldSeedStarterContent } from '../migrationMode.js'

function migrationResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

function migrationFixture({ categorySlug = 'javascript', currentCount = 3 } = {}) {
  const quizId = '507f1f77bcf86cd799439013'
  const questions = Array.from({ length: currentCount }, (_, index) => ({
    _id: `507f1f77bcf86cd7994390${String(index + 1).padStart(2, '0')}`,
    quiz: quizId,
    text: `Existing question ${index + 1}`,
    position: index,
  }))
  const quiz = {
    _id: quizId,
    title: 'JavaScript Basics',
    categorySlug,
    difficulty: 'Easy',
    questions: questions.slice(0, 2).map(question => question._id),
    totalQuestions: currentCount,
  }
  let nextId = currentCount + 1
  return {
    quiz,
    questions,
    repository: {
      async listQuizzesAndQuestions() {
        return { quizzes: [quiz], questions }
      },
      async insertQuestions(id, documents) {
        const inserted = documents.map(document => ({
          ...document,
          _id: `507f1f77bcf86cd7994390${String(nextId++).padStart(2, '0')}`,
        }))
        questions.push(...inserted)
        return inserted
      },
      async updateQuizQuestions(id, questionIds, totalQuestions) {
        quiz.questions = [...new Set([...quiz.questions, ...questionIds])]
        quiz.totalQuestions = totalQuestions
      },
      async countQuestions(id) {
        return questions.filter(question => String(question.quiz) === String(id)).length
      },
    },
  }
}

function migrationBatch(questions = [
  {
    text: 'Existing question 1',
    options: ['One', 'Two', 'Three', 'Four'],
    correctAnswer: 0,
    explanation: 'This candidate duplicates an existing question.',
  },
  {
    text: 'What does Array.isArray([]) return?',
    options: ['true', 'false', '0', 'undefined'],
    correctAnswer: 0,
    explanation: 'Array.isArray returns true when its argument is an array.',
  },
  {
    text: 'Which keyword declares a block-scoped variable?',
    options: ['let', 'goto', 'define', 'package'],
    correctAnswer: 0,
    explanation: 'The let keyword declares a block-scoped variable.',
  },
]) {
  return {
    formatVersion: 1,
    batchId: 'reviewed-test-batch',
    quizzes: [{
      categorySlug: 'javascript',
      title: 'JavaScript Basics',
      difficulty: 'Easy',
      questions,
    }],
  }
}

test('migration mode is enabled only by the explicit flag and alone skips starter seeding', () => {
  assert.equal(isQuizQuestionMigrationModeEnabled({ QUIZ_QUESTION_MIGRATION_MODE: 'enabled' }), true)
  assert.equal(isQuizQuestionMigrationModeEnabled({ QUIZ_QUESTION_MIGRATION_MODE: 'true' }), false)
  assert.equal(isQuizQuestionMigrationModeEnabled({}), false)
  assert.equal(shouldSeedStarterContent({ QUIZ_QUESTION_MIGRATION_MODE: 'enabled' }), false)
  assert.equal(shouldSeedStarterContent({ QUIZ_QUESTION_MIGRATION_MODE: 'true' }), true)
  assert.equal(shouldSeedStarterContent({}), true)
})

test('reviewed migration endpoint is disabled without explicit migration mode or a high-entropy token', async () => {
  let loadCalls = 0
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => { loadCalls += 1; return migrationBatch() },
    getMigrationToken: () => 'short-token',
    isMigrationModeEnabled: () => false,
  })
  const response = migrationResponse()

  await handler({ headers: {}, body: {} }, response)

  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.body, { error: 'migration_unavailable' })
  assert.equal(loadCalls, 0)
})

test('reviewed migration endpoint rejects requests without the separate migration token', async () => {
  let loadCalls = 0
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => { loadCalls += 1; return migrationBatch() },
    getMigrationToken: () => 'x'.repeat(40),
    isMigrationModeEnabled: () => true,
  })
  const response = migrationResponse()

  await handler({ headers: {}, body: {} }, response)

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'migration_not_authorized' })
  assert.equal(loadCalls, 0)
})

test('reviewed migration endpoint rejects caller-supplied batch data', async () => {
  let loadCalls = 0
  const token = 't'.repeat(40)
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => { loadCalls += 1; return migrationBatch() },
    getMigrationToken: () => token,
    isMigrationModeEnabled: () => true,
  })
  const response = migrationResponse()

  await handler({
    headers: { 'x-quiz-question-migration-token': token },
    body: { batch: migrationBatch() },
  }, response)

  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.body, { error: 'request_body_not_allowed' })
  assert.equal(loadCalls, 0)
})

test('reviewed migration endpoint adds only the exact shortfall and returns sanitized counts', async () => {
  const token = 't'.repeat(40)
  const { repository, questions, quiz } = migrationFixture()
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => migrationBatch(),
    createRepository: () => repository,
    getMigrationToken: () => token,
    isMigrationModeEnabled: () => true,
  })
  const response = migrationResponse()

  await handler({
    headers: { 'x-quiz-question-migration-token': token },
    body: {},
  }, response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, {
    results: [{
      title: 'JavaScript Basics',
      difficulty: 'Easy',
      previousQuestionCount: 3,
      questionsAdded: 2,
      finalQuestionCount: 5,
      targetQuestionCount: 5,
    }],
  })
  assert.equal(questions.length, 5)
  assert.equal(questions[0].text, 'Existing question 1')
  assert.equal(quiz.questions.length, 4)
  assert.ok(quiz.questions.includes(questions[0]._id))
  assert.ok(quiz.questions.includes(questions[1]._id))
  assert.ok(!quiz.questions.includes(questions[2]._id))
  assert.doesNotMatch(JSON.stringify(response.body), /token|secret|password|507f1f77/i)
})

test('reviewed migration endpoint fails closed on quiz identity mismatch', async () => {
  const token = 't'.repeat(40)
  const { repository, questions } = migrationFixture({ categorySlug: 'other-topic' })
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => migrationBatch(),
    createRepository: () => repository,
    getMigrationToken: () => token,
    isMigrationModeEnabled: () => true,
  })
  const response = migrationResponse()

  await handler({
    headers: { 'x-quiz-question-migration-token': token },
    body: {},
  }, response)

  assert.equal(response.statusCode, 409)
  assert.deepEqual(response.body, { error: 'migration_preflight_failed' })
  assert.equal(questions.length, 3)
})

test('reviewed migration endpoint validates model candidates before writing', async () => {
  const token = 't'.repeat(40)
  const { repository, questions } = migrationFixture()
  class InvalidQuestion {
    validateSync() {
      return new Error('invalid fixture')
    }
  }
  const handler = createReviewedQuestionMigrationHandler({
    loadBatch: async () => migrationBatch(),
    createRepository: () => repository,
    questionModel: InvalidQuestion,
    getMigrationToken: () => token,
    isMigrationModeEnabled: () => true,
  })
  const response = migrationResponse()

  await handler({
    headers: { 'x-quiz-question-migration-token': token },
    body: {},
  }, response)

  assert.equal(response.statusCode, 422)
  assert.deepEqual(response.body, { error: 'migration_preflight_failed' })
  assert.equal(questions.length, 3)
})

test('JWT login roles control access to admin APIs', async () => {
  const previousSecret = process.env.JWT_SECRET
  const originals = {
    findOne: User.findOne,
    findById: User.findById,
    findUsers: User.find,
    userCount: User.countDocuments,
    quizCount: Quiz.countDocuments,
    quizFind: Quiz.find,
    questionCount: Question.countDocuments,
    attemptCount: Attempt.countDocuments,
    attemptAggregate: Attempt.aggregate,
    attemptFind: Attempt.find,
  }
  const secret = 'test-only-jwt-secret'
  process.env.JWT_SECRET = secret
  const identities = {
    'learner@example.test': { id: '507f1f77bcf86cd799439011', name: 'Learner', username: 'fixture_learner', email: 'learner@example.test', role: 'user' },
    'admin@example.test': { id: '507f1f77bcf86cd799439012', name: 'Admin', email: 'admin@example.test', username: 'fixture_admin', role: 'admin' },
  }
  const lastActivity = new Date('2026-10-01T12:34:56.000Z')
  const recentAttempt = {
    user: { name: 'Learner', username: 'fixture_learner', email: 'learner@example.test' },
    quiz: { title: 'Science basics', category: { name: 'Science' } },
    score: 3,
    percentage: 75,
    createdAt: lastActivity,
  }
  User.findOne = query => ({ select: async () => {
    const identity = query.email
      ? identities[query.email]
      : Object.values(identities).find(item => item.username === query.username)
    return identity && { ...identity, comparePassword: async password => password === 'test-password' }
  } })
  User.findById = id => {
    const identity = Object.values(identities).find(item => item.id === String(id))
    const user = identity && { ...identity, _id: identity.id, save: async () => {} }
    return Object.assign(Promise.resolve(user), { select: async () => user })
  }
  User.find = () => ({
    select() { return this },
    sort() { return this },
    limit() { return this },
    lean: async () => [{
      _id: identities['learner@example.test'].id,
      ...identities['learner@example.test'],
      createdAt: new Date('2026-09-01T08:00:00.000Z'),
      password: 'must-not-leak',
      passwordHash: 'must-not-leak',
    }],
  })
  User.countDocuments = async () => 2
  Quiz.countDocuments = async () => 3
  Question.countDocuments = async () => 4
  Attempt.countDocuments = async () => 5
  Quiz.find = () => ({ select() { return this }, populate() { return this }, sort() { return this }, lean: async () => [] })
  Attempt.aggregate = async pipeline => {
    if (pipeline[0]?.$match) return [{ _id: identities['learner@example.test'].id, attempts: 3, averageScore: 82, lastActivity }]
    if (pipeline[0]?.$group?._id === '$quiz') return []
    return [{ _id: null, average: 75 }]
  }
  Attempt.find = () => ({
    sort() { return this },
    limit() { return this },
    populate() { return this },
    lean: async () => [recentAttempt],
  })

  const app = express()
  app.use(express.json())
  app.use('/auth', authRoutes)
  app.use('/admin', adminRoutes)
  app.use('/categories', categoryRoutes)
  app.use('/quizzes', quizRoutes)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const login = async (identity, field = 'identifier') => fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [field]: identity, password: 'test-password' }),
    })
    const [learnerLogin, adminLogin] = await Promise.all([
      login('learner@example.test', 'email'),
      login('fixture_admin'),
    ])
    assert.equal(learnerLogin.status, 200)
    assert.equal(adminLogin.status, 200)
    const learnerData = await learnerLogin.json()
    const adminData = await adminLogin.json()
    assert.equal(learnerData.user.role, 'user')
    assert.equal(adminData.user.role, 'admin')
    assert.equal('password' in adminData.user, false)
    assert.equal(jwt.verify(adminData.token, secret).sub, identities['admin@example.test'].id)

    const unauthenticated = await fetch(`${baseUrl}/admin/stats`)
    assert.equal(unauthenticated.status, 401)
    const unauthenticatedUsers = await fetch(`${baseUrl}/admin/users`)
    assert.equal(unauthenticatedUsers.status, 401)
    const unauthenticatedMigration = await fetch(`${baseUrl}/admin/migrations/reviewed-questions`, { method: 'POST' })
    assert.equal(unauthenticatedMigration.status, 401)
    const learnerResponse = await fetch(`${baseUrl}/admin/stats`, { headers: { authorization: `Bearer ${learnerData.token}` } })
    assert.equal(learnerResponse.status, 403)
    const learnerUsers = await fetch(`${baseUrl}/admin/users`, { headers: { authorization: `Bearer ${learnerData.token}` } })
    assert.equal(learnerUsers.status, 403)
    const learnerMigration = await fetch(`${baseUrl}/admin/migrations/reviewed-questions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${learnerData.token}` },
    })
    assert.equal(learnerMigration.status, 403)
    const learnerQuizStats = await fetch(`${baseUrl}/admin/stats/quizzes`, { headers: { authorization: `Bearer ${learnerData.token}` } })
    assert.equal(learnerQuizStats.status, 403)
    const learnerCategoryCreate = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { authorization: `Bearer ${learnerData.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Restricted subject' }),
    })
    assert.equal(learnerCategoryCreate.status, 403)
    const learnerQuizCreate = await fetch(`${baseUrl}/quizzes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${learnerData.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(learnerQuizCreate.status, 403)
    const learnerQuestionDelete = await fetch(`${baseUrl}/quizzes/507f1f77bcf86cd799439013/questions/507f1f77bcf86cd799439014`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${learnerData.token}` },
    })
    assert.equal(learnerQuestionDelete.status, 403)
    const adminResponse = await fetch(`${baseUrl}/admin/stats`, { headers: { authorization: `Bearer ${adminData.token}` } })
    assert.equal(adminResponse.status, 200)
    const adminStats = await adminResponse.json()
    assert.deepEqual(adminStats, {
      users: 2,
      quizzes: 3,
      questions: 4,
      attempts: 5,
      averageScore: 75,
      recentAttempts: [{
        user: 'Learner',
        username: 'fixture_learner',
        email: 'learner@example.test',
        quiz: 'Science basics',
        category: 'Science',
        score: 3,
        percentage: 75,
        createdAt: lastActivity.toISOString(),
      }],
    })
    assert.doesNotMatch(JSON.stringify(adminStats), /password|passwordHash|JWT_SECRET|secret/i)
    const adminUsersResponse = await fetch(`${baseUrl}/admin/users`, { headers: { authorization: `Bearer ${adminData.token}` } })
    assert.equal(adminUsersResponse.status, 200)
    const adminUsers = await adminUsersResponse.json()
    assert.deepEqual(adminUsers, [{
      _id: identities['learner@example.test'].id,
      name: 'Learner',
      username: 'fixture_learner',
      email: 'learner@example.test',
      role: 'user',
      createdAt: '2026-09-01T08:00:00.000Z',
      attempts: 3,
      averageScore: 82,
      lastActivity: lastActivity.toISOString(),
    }])
    assert.doesNotMatch(JSON.stringify(adminUsers), /password|passwordHash|JWT_SECRET|secret/i)
    const adminQuizStats = await fetch(`${baseUrl}/admin/stats/quizzes`, { headers: { authorization: `Bearer ${adminData.token}` } })
    assert.equal(adminQuizStats.status, 200)
    assert.deepEqual(await adminQuizStats.json(), [])
    const roleChange = await fetch(`${baseUrl}/admin/users/${identities['learner@example.test'].id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${adminData.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    })
    assert.equal(roleChange.status, 200)
    assert.equal((await roleChange.json()).role, 'admin')
    const selfDemotion = await fetch(`${baseUrl}/admin/users/${identities['admin@example.test'].id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${adminData.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'user' }),
    })
    assert.equal(selfDemotion.status, 409)
  } finally {
    await new Promise(resolve => server.close(resolve))
    User.findOne = originals.findOne
    User.findById = originals.findById
    User.find = originals.findUsers
    User.countDocuments = originals.userCount
    Quiz.countDocuments = originals.quizCount
    Quiz.find = originals.quizFind
    Question.countDocuments = originals.questionCount
    Attempt.countDocuments = originals.attemptCount
    Attempt.aggregate = originals.attemptAggregate
    Attempt.find = originals.attemptFind
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  }
})
