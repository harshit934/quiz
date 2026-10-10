import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from './api.js'

test('exam starts can wait for server wake-up without changing other request timeouts', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let scheduledDelay
  let cleared = 0
  let abort
  globalThis.window = {
    setTimeout(callback, delay) { abort = callback; scheduledDelay = delay; return 42 },
    clearTimeout(handle) { assert.equal(handle, 42); cleared++ },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'student-session' } })
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/exams/exam-id/attempt')
      assert.equal(options.headers.get('Authorization'), 'Bearer student-session')
      assert.equal(options.headers.get('Content-Type'), 'application/json')
      assert.equal(options.body, '{"accessCode":"AJFJ12"}')
      assert.equal('timeoutMs' in options, false)
      assert.equal(options.signal.aborted, false)
      return { ok: true, json: async () => ({ _id: 'attempt-id' }) }
    }
    const result = await request('/exams/exam-id/attempt', {
      method: 'POST', body: JSON.stringify({ accessCode: 'AJFJ12' }), timeoutMs: 90000,
    })
    assert.equal(result._id, 'attempt-id')
    assert.equal(scheduledDelay, 90000)
    assert.equal(cleared, 1)

    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
    await request('/exams')
    assert.equal(scheduledDelay, 5000)
    assert.equal(cleared, 2)

    globalThis.fetch = async (url, options) => {
      abort()
      assert.equal(options.signal.aborted, true)
      throw new DOMException('Request timed out', 'AbortError')
    }
    await assert.rejects(request('/exams/exam-id/attempt', { timeoutMs: 90000 }), error =>
      error.name === 'AbortError' && error.networkUnavailable === true)
    assert.equal(cleared, 3)
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})
