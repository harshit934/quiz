import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import jwt from 'jsonwebtoken'
import test from 'node:test'
import User from '../models/User.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import Attempt from '../models/Attempt.js'
import adminRoutes from './admin.js'
import authRoutes from './auth.js'
import categoryRoutes from './categories.js'
import quizRoutes from './quizzes.js'

test('JWT login roles control access to admin APIs', async () => {
  const previousSecret = process.env.JWT_SECRET
  const originals = {
    findOne: User.findOne,
    findById: User.findById,
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
    'learner@example.test': { id: '507f1f77bcf86cd799439011', name: 'Learner', email: 'learner@example.test', role: 'user' },
    'admin@example.test': { id: '507f1f77bcf86cd799439012', name: 'Admin', email: 'admin@example.test', role: 'admin' },
  }
  User.findOne = query => ({
    select: async () => ({
      ...identities[query.email],
      comparePassword: async password => password === 'test-password',
    }),
  })
  User.findById = id => {
    const identity = Object.values(identities).find(item => item.id === String(id))
    const user = identity && { ...identity, _id: identity.id, save: async () => {} }
    return Object.assign(Promise.resolve(user), { select: async () => user })
  }
  User.countDocuments = async () => 2
  Quiz.countDocuments = async () => 3
  Question.countDocuments = async () => 4
  Attempt.countDocuments = async () => 5
  Quiz.find = () => ({ select() { return this }, populate() { return this }, sort() { return this }, lean: async () => [] })
  Attempt.aggregate = async pipeline => pipeline[0]?.$match ? [] : [{ _id: null, average: 75 }]
  Attempt.find = () => ({
    sort() { return this },
    limit() { return this },
    populate() { return this },
    lean: async () => [],
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
    const login = async email => fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-password' }),
    })
    const [learnerLogin, adminLogin] = await Promise.all([
      login('learner@example.test'),
      login('admin@example.test'),
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
    const learnerResponse = await fetch(`${baseUrl}/admin/stats`, { headers: { authorization: `Bearer ${learnerData.token}` } })
    assert.equal(learnerResponse.status, 403)
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
    assert.deepEqual(await adminResponse.json(), {
      users: 2,
      quizzes: 3,
      questions: 4,
      attempts: 5,
      averageScore: 75,
      recentAttempts: [],
    })
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
