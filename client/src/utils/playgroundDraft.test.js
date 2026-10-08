import test from 'node:test'
import assert from 'node:assert/strict'
import { readPlaygroundDraft, savePlaygroundDraft } from './playgroundDraft.js'
test('playground save restores exact code and input without mixing accounts or languages', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }
  const draft = { code: 'def solve(input):\n    return input', input: '{"name":"Ada"}' }
  assert.equal(savePlaygroundDraft(storage, 'user1-python', draft), true)
  assert.deepEqual(readPlaygroundDraft(storage, 'user1-python'), draft)
  assert.equal(readPlaygroundDraft(storage, 'user2-python'), null)
  assert.equal(readPlaygroundDraft(storage, 'user1-html'), null)
  storage.setItem('user1-python', '{broken')
  assert.equal(readPlaygroundDraft(storage, 'user1-python'), null)
})
test('playground reports unavailable storage and rejects malformed drafts', () => {
  const storage = { setItem: () => { throw new Error('quota') }, getItem: () => '{"code":4}' }
  assert.equal(savePlaygroundDraft(storage, 'key', { code: '', input: '' }), false)
  assert.equal(readPlaygroundDraft(storage, 'key'), null)
})
