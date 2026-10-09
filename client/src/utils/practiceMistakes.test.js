import test from 'node:test'
import assert from 'node:assert/strict'
import { readPracticeMistakes, updatePracticeMistakes, writePracticeMistakes } from './practiceMistakes.js'

test('failed attempts retain exact question and code, deduplicate, and resolve after passing', () => {
  const challenge = { id: 'attempt-1', deadline: 123, draft: 'old', testCases: [{ name: 'case', expected: 4 }] }
  let items = updatePracticeMistakes([], challenge, 'wrong', [{ name: 'case', passed: false, actual: 0 }])
  assert.equal(items[0].challenge.deadline, undefined)
  assert.equal(items[0].code, 'wrong')
  items = updatePracticeMistakes(items, challenge, 'revised', [{ name: 'case', passed: false, actual: 2 }])
  assert.equal(items.length, 1)
  assert.equal(items[0].code, 'revised')
  items = updatePracticeMistakes(items, challenge, 'fixed', [{ name: 'case', passed: true }])
  assert.equal(items[0].resolved, true)
  assert.equal(items[0].code, 'revised')
  assert.equal(updatePracticeMistakes([], challenge, 'fixed', [{ passed: true }]).length, 0)
})

test('history is bounded, account scoped, and survives storage errors', () => {
  let items = []
  for (let i = 0; i < 55; i++) items = updatePracticeMistakes(items, { id: String(i), testCases: [] }, 'code', [{ passed: false }])
  assert.equal(items.length, 50)
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  assert.equal(writePracticeMistakes(storage, 'user1', items), true)
  assert.equal(readPracticeMistakes(storage, 'user1').length, 50)
  assert.deepEqual(readPracticeMistakes(storage, 'user2'), [])
  values.set('bad-mistakes', 'not json')
  assert.deepEqual(readPracticeMistakes(storage, 'bad'), [])
  assert.equal(writePracticeMistakes({ setItem() { throw Error('full') } }, 'user1', items), false)
})
