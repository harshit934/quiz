import test from 'node:test'
import assert from 'node:assert/strict'
import { codingScore, readCodingProgress, writeCodingProgress, readCodingDraft } from './codingProgress.js'

test('practice score reflects passed test cases and difficulty', () => {
  assert.equal(codingScore(3, 3, 'Easy'), 40)
  assert.equal(codingScore(2, 4, 'Medium'), 30)
  assert.equal(codingScore(0, 4, 'Hard'), 0)
  assert.equal(codingScore(4, 4, 'Hard'), 100)
  assert.equal(codingScore(1, 0, 'Easy'), 0)
})
test('local progress persists separately per learner and tolerates invalid storage', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const progress = { 'javascript-Easy': { passed: 3, total: 3, score: 40, status: 'Completed' } }
  assert.equal(writeCodingProgress(storage, 'learner-1', progress), true)
  assert.deepEqual(readCodingProgress(storage, 'learner-1'), progress)
  assert.deepEqual(readCodingProgress(storage, 'learner-2'), {})
  values.set('bad', 'invalid json')
  assert.deepEqual(readCodingProgress(storage, 'bad'), {})
  assert.equal(readCodingDraft(storage, 'learner-1'), null)
  storage.setItem('learner-1-saved-code', JSON.stringify({ code: 'function solve(input) { return input }', challenge: { subjectId: 'javascript', testCases: [{}] } }))
  assert.match(readCodingDraft(storage, 'learner-1').code, /function solve/)
})
