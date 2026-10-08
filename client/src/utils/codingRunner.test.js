import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker as NodeWorker } from 'node:worker_threads'
import { runCodingCases } from './codingRunner.js'
import { codingChallenges } from '../../../shared/codingChallenges.js'

// Execute the browser worker's actual source in a Node worker, with the same
// message protocol. This checks code errors and termination as well as scoring.
class BrowserWorker {
  constructor(url) {
    this.ready = fetch(url).then(response => response.text()).then(source => {
      if (this.stopped) return
      this.worker = new NodeWorker(`const { parentPort } = require('node:worker_threads');
        global.self = { postMessage: data => parentPort.postMessage(data) };
        ${source}
        parentPort.on('message', data => self.onmessage({data}));`, { eval: true })
      this.worker.on('message', data => this.onmessage?.({ data }))
      this.worker.on('error', error => this.onerror?.(error))
    })
  }
  postMessage(data) { this.ready.then(() => this.worker?.postMessage(data)) }
  terminate() { this.stopped = true; this.worker?.terminate() }
}

test('coding runner executes, scores, reports errors and terminates runaway code', async () => {
  const original = globalThis.Worker
  globalThis.Worker = BrowserWorker
  const cases = [{ name: 'Double', input: 3, expected: 6 }, { name: 'Zero', input: 0, expected: 0 }]
  try {
    assert.deepEqual((await runCodingCases('function solve(n) { return n * 2 }', cases)).map(item => item.passed), [true, true])
    assert.deepEqual((await runCodingCases('function solve() { return 0 }', cases)).map(item => item.passed), [false, true])
    await assert.rejects(runCodingCases('function solve( {', cases), /Unexpected/)
    await assert.rejects(runCodingCases('const answer = 1;', cases), /Define a function/)
    const errors = await runCodingCases('function solve() { throw new Error("bad input") }', cases)
    assert.equal(errors[0].error, 'bad input')
    assert.equal(errors.every(item => !item.passed), true)
    await assert.rejects(runCodingCases('function solve() { while (true) {} }', cases, 150), /timed out/)
    assert.equal((await runCodingCases('function solve(n) { return n * 2 }', cases))[0].passed, true)
    for (const challenge of codingChallenges) {
      const results = await runCodingCases(challenge.solution, challenge.testCases)
      assert.equal(results.every(item => item.passed), true, `${challenge.subject} ${challenge.difficulty}`)
    }
  } finally { globalThis.Worker = original }
})
