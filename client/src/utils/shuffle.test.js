import assert from 'node:assert/strict'
import test from 'node:test'
import { fisherYates, shuffleQuestionOptions } from './shuffle.js'

test('Fisher-Yates enumerates every four-option permutation exactly once', () => {
  const originalOptions = ['North', 'East', 'South', 'West']
  const question = { text: 'Which direction is north?', options: originalOptions, correctAnswer: 0 }
  const correctPositions = [0, 0, 0, 0]
  const observedPermutations = new Set()

  for (let firstSwap = 0; firstSwap < 4; firstSwap += 1) {
    for (let secondSwap = 0; secondSwap < 3; secondSwap += 1) {
      for (let thirdSwap = 0; thirdSwap < 2; thirdSwap += 1) {
        const choices = [firstSwap, secondSwap, thirdSwap]
        let choiceIndex = 0
        const random = () => (choices[choiceIndex++] + 0.5) / (4 - choiceIndex + 1)
        const shuffled = shuffleQuestionOptions(question, random)

        assert.deepEqual([...shuffled.options].sort(), [...originalOptions].sort())
        assert.equal(shuffled.options[shuffled.correctAnswer], originalOptions[question.correctAnswer])
        assert.equal(question.correctAnswer, 0)
        observedPermutations.add(shuffled.options.join('|'))
        correctPositions[shuffled.correctAnswer] += 1
      }
    }
  }

  assert.equal(observedPermutations.size, 24)
  assert.deepEqual(correctPositions, [6, 6, 6, 6])
})

test('shuffling leaves questions without a client answer key unmodified', () => {
  const question = { text: 'Private answer key', options: ['A', 'B', 'C', 'D'] }
  const shuffled = shuffleQuestionOptions(question, () => 0)

  assert.equal('correctAnswer' in shuffled, false)
  assert.deepEqual([...shuffled.options].sort(), [...question.options].sort())
})

test('question ordering also uses the shared Fisher-Yates helper', () => {
  assert.deepEqual(fisherYates([1, 2, 3], () => 0), [2, 3, 1])
})
