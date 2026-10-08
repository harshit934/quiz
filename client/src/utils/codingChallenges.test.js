import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { codingChallenges } from '../../../shared/codingChallenges.js'
import { flattenSubjectCategories } from '../../../shared/subjectCatalog.js'

test('every technology subject has separate Easy, Medium, and Hard coding exercises', () => {
  const subjects = flattenSubjectCategories().filter(item => item.rootSlug === 'technology' && item.slug !== 'technology')
  assert.equal(codingChallenges.length, subjects.length * 3)
  assert.equal(new Set(codingChallenges.map(item => item.id)).size, codingChallenges.length)
  for (const subject of subjects) {
    const challenges = codingChallenges.filter(item => item.subjectId === subject.slug)
    assert.deepEqual(challenges.map(item => item.difficulty), ['Easy', 'Medium', 'Hard'])
    assert.equal(new Set(challenges.map(item => item.solution)).size, 3)
  }
})

for (const challenge of codingChallenges) {
  test(`${challenge.subject} ${challenge.difficulty}: reference solution passes all cases`, () => {
    for (const testCase of challenge.testCases) {
      const context = vm.createContext({ input: structuredClone(testCase.input) })
      const actual = vm.runInContext(`${challenge.solution}; JSON.stringify(solve(input))`, context, { timeout: 500 })
      assert.deepEqual(JSON.parse(actual), testCase.expected, testCase.name)
    }
  })
}

test('hard grouping respects structural equality and first-seen order', () => {
  const challenge = codingChallenges.find(item => item.id === 'sql-hard')
  const input = [[{ region: 'A', amount: 1 }, { region: 'B', amount: 2 }], [{ region: 'B', amount: 2 }, { region: 'A', amount: 1 }]]
  const actual = vm.runInNewContext(`${challenge.solution}; JSON.stringify(solve(input))`, { input }, { timeout: 500 })
  assert.deepEqual(JSON.parse(actual), [{ value: { A: 1, B: 2 }, count: 2 }])
})
