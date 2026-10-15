import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import { createBookmarksRouter } from './bookmarks.js'

test('question bookmarks are authenticated, user-scoped, idempotent and omit answer keys', async () => {
  const questionId = '507f1f77bcf86cd799439011'
  const quizId = '507f1f77bcf86cd799439012'
  const entries = new Map()
  const BookmarkModel = {
    find: filter => ({
      sort() { return this },
      populate() { return this },
      lean: async () => [...entries.values()].filter(item => item.user === filter.user),
    }),
    exists: async filter => entries.has(`${filter.user}:${filter.question}`),
    updateOne: async (filter, update) => {
      const key = `${filter.user}:${filter.question}`
      if (!entries.has(key)) entries.set(key, { _id: `bookmark-${filter.user}`, ...update.$setOnInsert, question: { _id: questionId, text: 'Saved question', options: ['A', 'B'], correctAnswer: 1 }, quiz: { _id: quizId, title: 'Quiz', difficulty: 'Easy', category: { name: 'JavaScript', slug: 'javascript' } }, createdAt: new Date() })
      return { upsertedCount: 1 }
    },
    deleteOne: async filter => ({ deletedCount: entries.delete(`${filter.user}:${filter.question}`) ? 1 : 0 }),
  }
  const QuestionModel = { findById: () => ({ select: async () => ({ _id: questionId, quiz: quizId }) }) }
  const QuizModel = { findById: () => ({ select: async () => ({ _id: quizId }) }) }
  const auth = (req, res, next) => {
    if (!req.headers['x-test-user']) return res.status(401).json({ message: 'Sign in.' })
    req.user = { _id: req.headers['x-test-user'] }
    next()
  }
  const app = express()
  app.use('/bookmarks', createBookmarksRouter({ BookmarkModel, QuestionModel, QuizModel, auth }))
  app.use((error, req, res, next) => res.status(500).json({ message: error.message }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/bookmarks`
  const call = (user, path, options = {}) => fetch(`${base}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(user ? { 'x-test-user': user } : {}) },
  })

  test('custom practice quiz creation only uses the signed-in learner saved questions', async () => {
    const firstId = '507f1f77bcf86cd799439021'
    const secondId = '507f1f77bcf86cd799439022'
    const categoryId = '507f1f77bcf86cd799439023'
    const questions = [firstId, secondId].map((id, position) => ({
      _id: id,
      text: `Saved question ${position + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: position,
      explanation: `Explanation ${position + 1}`,
      quiz: { difficulty: 'Easy', category: { _id: categoryId } },
    }))
    const saved = new Set([`alice:${firstId}`, `alice:${secondId}`])
    const created = []
    const inserted = []
    const BookmarkModel = {
      find: filter => ({
        select() { return this },
        lean: async () => filter.question.$in
          .filter(questionId => saved.has(`${filter.user}:${questionId}`))
          .map(question => ({ question })),
      }),
    }
    const QuestionModel = {
      find: filter => ({
        populate() { return this },
        lean: async () => questions.filter(question => filter._id.$in.includes(question._id)),
      }),
      insertMany: async rows => {
        inserted.push(...rows)
        return rows.map((row, index) => ({ ...row, _id: `new-question-${index}` }))
      },
      deleteMany: async () => {},
    }
    const QuizModel = {
      create: async data => {
        const quiz = {
          ...data,
          _id: `private-quiz-${created.length}`,
          save: async () => {},
        }
        created.push(quiz)
        return quiz
      },
      deleteOne: async () => {},
    }
    const auth = (req, res, next) => {
      req.user = { _id: req.headers['x-test-user'] }
      next()
    }
    const app = express()
    app.use(express.json())
    app.use('/bookmarks', createBookmarksRouter({ BookmarkModel, QuestionModel, QuizModel, auth }))
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }))
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/bookmarks/practice`
    const create = (user, body) => fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': user },
      body: JSON.stringify(body),
    })

    try {
      const foreign = await create('bob', { questionIds: [firstId], shuffle: false })
      assert.equal(foreign.status, 403)
      const oversized = await create('alice', { questionIds: [firstId], questionCount: 2, shuffle: false })
      assert.equal(oversized.status, 400)
      assert.equal(created.length, 0)

      const response = await create('alice', { questionIds: [firstId, secondId], questionCount: 1, shuffle: false })
      assert.equal(response.status, 201)
      const result = await response.json()
      assert.equal(result.questionCount, 1)
      assert.equal(created[0].isPrivate, true)
      assert.equal(created[0].createdBy, 'alice')
      assert.equal(inserted.length, 1)
      assert.equal(inserted[0].text, 'Saved question 1')
      assert.equal(inserted[0].correctAnswer, 0)
    } finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  try {
    assert.equal((await call(null, `/${questionId}`)).status, 401)
    assert.equal((await call('alice', `/${questionId}`, { method: 'PUT' })).status, 200)
    assert.equal((await call('alice', `/${questionId}`, { method: 'PUT' })).status, 200)
    assert.equal((await (await call('alice', `/${questionId}`)).json()).bookmarked, true)
    assert.equal((await (await call('bob', `/${questionId}`)).json()).bookmarked, false)
    const listed = await (await call('alice', '')).json()
    assert.equal(listed.length, 1)
    assert.equal('correctAnswer' in listed[0].question, false)
    const foreignRemoval = await call('bob', `/${questionId}`, { method: 'DELETE' })
    assert.equal((await foreignRemoval.json()).deleted, false)
    const removed = await call('alice', `/${questionId}`, { method: 'DELETE' })
    assert.equal((await removed.json()).deleted, true)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
