import test from 'node:test'
import assert from 'node:assert/strict'
import { runCompiler, validCompilerRequest } from './compiler.js'
import app from '../app.js'
import { compilerLanguages } from '../../../shared/playgroundLanguages.js'
const request = { runtime: 'java', code: 'public class Main {}', testCases: [{ name: 'Case 1', stdin: '2 3', expected: 5 }] }
test('compiler setup is required and unsafe runtimes are rejected', async () => {
  await assert.rejects(runCompiler(request, {}), /not configured/)
  assert.equal(validCompilerRequest(request), true)
  assert.equal(validCompilerRequest({ ...request, runtime: 'powershell' }), false)
  assert.equal(validCompilerRequest({ ...request, code: 'x'.repeat(40001) }), false)
  assert.equal(validCompilerRequest({ ...request, testCases: Array(11).fill(request.testCases[0]) }), false)
  assert.equal(validCompilerRequest({ ...request, testCases: [null] }), false)
})

test('compiler status and setup message work without a database connection', async () => {
  const prior = process.env.JUDGE0_URL
  delete process.env.JUDGE0_URL
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/coding`
  try {
    const status = await fetch(url + '/status')
    assert.deepEqual(await status.json(), { configured: false })
    const response = await fetch(url + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
    assert.equal(response.status, 503)
    assert.match((await response.json()).message, /JUDGE0_URL/)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); if (prior === undefined) delete process.env.JUDGE0_URL; else process.env.JUDGE0_URL = prior }
})
test('compiler requests sandbox limits and checks stdout', async () => {
  let payload
  const fetcher = async (url, options) => {
    if (options.method === 'POST') { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ token: 'test' }) } }
    return { ok: true, json: async () => ({ status: { id: 3 }, stdout: '5\n' }) }
  }
  const result = await runCompiler(request, { JUDGE0_URL: 'https://compiler.example' }, fetcher)
  assert.equal(payload.enable_network, false)
  assert.equal(payload.cpu_time_limit, 3)
  assert.equal(result[0].passed, true)
  const failed = await runCompiler({ ...request, testCases: [{ ...request.testCases[0], expected: 7 }] }, { JUDGE0_URL: 'https://compiler.example' }, fetcher)
  assert.equal(failed[0].passed, false)
})
test('compilation failures are reported instead of passing', async () => {
  const fetcher = async (url, options) => ({ ok: true, json: async () => options.method === 'POST' ? { token: 'test' } : { status: { id: 6 }, compile_output: 'syntax error' } })
  const result = await runCompiler(request, { JUDGE0_URL: 'https://compiler.example' }, fetcher)
  assert.equal(result[0].passed, false)
  assert.equal(result[0].error, 'syntax error')
})

test('every playground compiler language uses its ID and preserves script stdin and output', async () => {
  for (const [runtime, , id, code] of compilerLanguages) {
    let payload
    const fetcher = async (url, options) => {
      if (options.method === 'POST') { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ token: 'test' }) } }
      return { ok: true, json: async () => ({ status: { id: 3 }, stdout: '001\nHello\n' }) }
    }
    const body = { runtime, code, playground: true, testCases: [{ name: 'Output', stdin: 'sample input', expected: null }] }
    assert.equal(validCompilerRequest(body), true, runtime)
    const result = await runCompiler(body, { JUDGE0_URL: 'https://compiler.example' }, fetcher)
    assert.equal(payload.language_id, id, runtime)
    assert.equal(payload.source_code, code, runtime)
    assert.equal(payload.stdin, 'sample input', runtime)
    assert.equal(result[0].actual, '001\nHello', runtime)
    assert.equal(payload.enable_network, false)
  }
})
