import test from 'node:test'
import assert from 'node:assert/strict'
import { readPlaygroundDraft, readPlaygroundLanguage, savePlaygroundDraft } from './playgroundDraft.js'
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

test('reopening selects the saved language and restores its draft for the same account', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const draft = { code: 'print("saved Python")', input: '' }
  assert.equal(savePlaygroundDraft(storage, 'quizly-playground-user1-python', draft), true)
  storage.setItem('quizly-playground-user1-language', 'python')
  const language = readPlaygroundLanguage(storage, 'user1', ['javascript', 'python'])
  assert.equal(language, 'python')
  assert.deepEqual(readPlaygroundDraft(storage, `quizly-playground-user1-${language}`), draft)
  assert.equal(readPlaygroundLanguage(storage, 'user2', ['javascript', 'python']), 'javascript')
  storage.setItem('quizly-playground-user1-language', 'invalid')
  assert.equal(readPlaygroundLanguage(storage, 'user1', ['javascript', 'python']), 'javascript')
})

test('save does not report success when storage silently drops the write', () => {
  const storage = { getItem: () => null, setItem: () => {} }
  assert.equal(savePlaygroundDraft(storage, 'key', { code: 'saved', input: '' }), false)
})
