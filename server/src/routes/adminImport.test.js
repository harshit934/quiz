import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import { createAdminImportRouter } from './adminImport.js'

test('bulk import previews duplicates and writes question batches within a transaction', async () => {
  const category = { _id: 'category-1', slug: 'science' }
  const quiz = { _id: 'quiz-1', category: 'category-1', title: 'Science basics', difficulty: 'Easy', questions: [] }
  const sessions = []
  const insertedQuestions = []
  const references = []
  const query = value => {
    const result = {
      select() { return result },
      sort() { return result },
      session(session) { sessions.push(session); return result },
      lean: async () => value,
    }
    return result
  }
  const CategoryModel = { findOne: () => query(category) }
  const QuizModel = {
    find: () => query([quiz]),
    updateOne: async (_filter, update, options) => {
      if (options.session) sessions.push(options.session)
      references.push(...update.$addToSet.questions.$each)
      return { matchedCount: 1 }
    },
  }
  const QuestionModel = {
    find: () => query([]),
    insertMany: async (rows, options) => {
      assert.ok(options.session)
      insertedQuestions.push(...rows)
      return rows.map((row, index) => ({ ...row, _id: `question-${index}` }))
    },
  }
  let transactionCount = 0
  let ended = false
  const startSession = async () => ({
    withTransaction: async callback => { transactionCount += 1; await callback() },
    endSession: async () => { ended = true },
  })
  const app = express()
  app.use(express.json())
  app.use('/admin/import', createAdminImportRouter({
    auth: (req, res, next) => { req.user = { _id: 'admin' }; next() },
    admin: (req, res, next) => next(),
    CategoryModel,
    QuizModel,
    QuestionModel,
    startSession,
  }))
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/admin/import`
  const body = {
    format: 'json',
    content: JSON.stringify({
      formatVersion: 1,
      batchId: 'test-batch',
      quizzes: [{
        categorySlug: 'science',
        title: 'Science basics',
        difficulty: 'Easy',
        questions: [{ text: 'What is the answer?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0, explanation: 'A is correct.' }],
      }],
    }),
  }

  try {
    const previewResponse = await fetch(`${url}/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const preview = await previewResponse.json()
    assert.equal(preview.valid, true)
    assert.equal(preview.questionCount, 1)

    const commitResponse = await fetch(`${url}/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    assert.equal(commitResponse.status, 201)
    assert.equal((await commitResponse.json()).insertedQuestionCount, 1)
    assert.equal(transactionCount, 1)
    assert.equal(ended, true)
    assert.equal(insertedQuestions.length, 1)
    assert.deepEqual(references, ['question-0'])
    assert.ok(sessions.length >= 3)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
