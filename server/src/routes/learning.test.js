import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createLearningRouter, validateLearningOperation } from './learning.js'
import { generateCodingChallenge } from '../../../shared/generateCodingChallenge.js'

test('learning API isolates users, deduplicates requests and merges simultaneous updates', async () => {
  const rows = new Map()
  const Model = {
    findOne: async ({ user }) => structuredClone(rows.get(user) || null),
    create: async row => { if (rows.has(row.user)) throw Object.assign(Error('duplicate'), { code: 11000 }); rows.set(row.user, structuredClone(row)); return row },
    findOneAndUpdate: async (filter, update) => {
      const row = rows.get(filter.user)
      if (!row || row.revision !== filter.revision) return null
      row.state = update.$set.state; row.revision++
      return structuredClone(row)
    },
  }
  const auth = (req, res, next) => { if (!req.headers['x-test-user']) return res.sendStatus(401); req.user = { _id: req.headers['x-test-user'] }; next() }
  const app = express(); app.use(express.json()); app.use('/learning', createLearningRouter(Model, auth)); app.use((error, req, res, next) => res.status(error.name === 'ZodError' ? 400 : error.status || 500).json({ message: error.message }))
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const call = (user, body) => fetch(`http://127.0.0.1:${server.address().port}/learning`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  try {
    assert.equal((await call(null)).status, 401)
    const goal = { id: 'goal', type: 'goal', data: { goal: 5 }, user: 'bob' }
    assert.equal((await call('alice', goal)).status, 200)
    assert.equal((await call('alice', goal)).status, 200)
    assert.equal(rows.get('alice').state.operations.length, 1)
    assert.equal((await (await call('bob')).json()).state.goal, 3)
    const updates = await Promise.all(['one', 'two'].map(id => call('alice', { id, type: 'bookmark', data: { key: id, item: { kind: 'quiz', title: id, quizId: id } } })))
    assert.ok(updates.every(response => response.status === 200))
    const state = (await (await call('alice')).json()).state
    assert.equal(state.goal, 5)
    assert.deepEqual(Object.keys(state.bookmarks).sort(), ['one', 'two'])
    assert.equal((await call('alice', { operations: [{ id: 'g2', type: 'goal', data: { goal: 10 } }, { id: 'b3', type: 'bookmark', data: { key: 'three', item: { kind: 'quiz', title: 'Third', quizId: 'three' } } }] })).status, 200)
    const batchState = (await (await call('alice')).json()).state
    assert.equal(batchState.goal, 10)
    assert.equal(batchState.bookmarks.three.title, 'Third')
    assert.equal((await call('alice', { id: 'invalid', type: 'goal', data: { goal: 0 } })).status, 400)
    assert.equal((await call('alice', { id: 'invalid', type: 'bookmark', data: { key: 'empty' } })).status, 400)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
test('compiler-independent coding updates accept generated questions and reject oversized code', () => {
  const challenge = generateCodingChallenge('programming', 'Easy', 1)
  const body = { id: 'coding', type: 'coding', data: { challenge, code: 'function solve() { return 0 }', results: [{ name: 'Case 1', passed: false, actual: 0 }], day: '2026-10-09', progress: { subjectId: 'programming', difficulty: 'Easy', total: 3, passed: 0, score: 0, status: 'In progress', tested: true } } }
  assert.equal(validateLearningOperation(body).data.challenge.id, challenge.id)
  assert.throws(() => validateLearningOperation({ ...body, data: { ...body.data, code: 'x'.repeat(100001) } }))
})
