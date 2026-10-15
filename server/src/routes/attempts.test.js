import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import { createIncorrectRetryRouter } from './attempts.js'

test('retry quiz contains only incorrect answers from the learner owned, verified attempt', async () => {
  const attemptId = '507f1f77bcf86cd799439041'
  const attempt = {
    _id: attemptId,
    user: 'alice',
    quiz: 'source-quiz',
    answers: [
      { selectedOption: 'Wrong', questionSnapshot: { text: 'Missed', options: ['Right', 'Wrong', 'Third', 'Fourth'], correctAnswer: 0, explanation: 'Learn the correct answer.' } },
      { selectedOption: 'Right', questionSnapshot: { text: 'Correct', options: ['Right', 'Wrong', 'Third', 'Fourth'], correctAnswer: 0 } },
      { selectedOption: '', questionSnapshot: { text: 'Skipped', options: ['Right', 'Wrong', 'Third', 'Fourth'], correctAnswer: 0 } },
    ],
  }
  const insertedQuestions = []
  let createdQuiz
  const AttemptModel = { findOne: async filter => filter.user === attempt.user && filter._id === attempt._id ? attempt : null }
  const QuizModel = {
    findById: () => ({ select: async () => ({ category: 'category-1', difficulty: 'Medium', isPrivate: false }) }),
    create: async input => {
      createdQuiz = { ...input, _id: 'retry-quiz', save: async () => {} }
      return createdQuiz
    },
    deleteOne: async () => {},
  }
  const QuestionModel = {
    insertMany: async rows => {
      insertedQuestions.push(...rows)
      return rows.map((row, index) => ({ ...row, _id: `retry-question-${index}` }))
    },
    deleteMany: async () => {},
  }
  const auth = (req, res, next) => {
    req.user = { _id: req.headers['x-test-user'] }
    next()
  }
  const app = express()
  app.use('/attempts', createIncorrectRetryRouter({ auth, AttemptModel, QuizModel, QuestionModel }))
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/attempts/${attemptId}/retry`

  try {
    const foreign = await fetch(base, { method: 'POST', headers: { 'x-test-user': 'bob' } })
    assert.equal(foreign.status, 404)
    const response = await fetch(base, { method: 'POST', headers: { 'x-test-user': 'alice' } })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).questionCount, 1)
    assert.equal(createdQuiz.isPrivate, true)
    assert.equal(createdQuiz.createdBy, 'alice')
    assert.equal(insertedQuestions.length, 1)
    assert.equal(insertedQuestions[0].text, 'Missed')
    assert.equal(insertedQuestions[0].correctAnswer, 0)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('retry quiz refuses attempts with no incorrect answered questions', async () => {
  const AttemptModel = { findOne: async () => ({
    quiz: 'source-quiz',
    answers: [{ selectedOption: 'Right', questionSnapshot: { options: ['Right', 'Wrong', 'Third', 'Fourth'], correctAnswer: 0 } }],
  }) }
  const app = express()
  app.use('/attempts', createIncorrectRetryRouter({
    AttemptModel,
    auth: (req, res, next) => { req.user = { _id: 'alice' }; next() },
  }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/attempts/attempt/retry`, { method: 'POST' })
    assert.equal(response.status, 409)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
