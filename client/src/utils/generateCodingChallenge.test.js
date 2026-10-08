import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { codingChallenges } from '../../../shared/codingChallenges.js'
import { generateJavaScriptChallenge as generateCodingChallenge, nextCodingAttempt } from '../../../shared/generateCodingChallenge.js'

test('fresh coding questions and passing reference cases for every subject and level', () => {
  for (const base of codingChallenges) {
    let previous
    for (const attempt of [1, 2, 3, 4, 5]) {
      const generated = generateCodingChallenge(base.subjectId, base.difficulty, attempt)
      assert.equal(generated.subject, base.subject)
      assert.equal(generated.difficulty, base.difficulty)
      if (previous) {
        assert.notEqual(generated.description, previous.description)
        assert.notDeepEqual(generated.testCases, previous.testCases)
      }
      for (const fixture of generated.testCases) {
        const actual = vm.runInNewContext(`${generated.solution}; JSON.stringify(solve(input))`, { input: structuredClone(fixture.input) }, { timeout: 500 })
        assert.deepEqual(JSON.parse(actual), fixture.expected, generated.id)
      }
      previous = generated
    }
  }
})

test('attempt sequence persists and works when browser storage is unavailable', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const first = nextCodingAttempt(storage)
  assert.equal(nextCodingAttempt(storage), first + 1)
  const broken = { getItem() { throw new Error('disabled') }, setItem() { throw new Error('disabled') } }
  assert.equal(nextCodingAttempt(broken), first + 2)
})
