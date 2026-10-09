import test from 'node:test'
import assert from 'node:assert/strict'
import { applyLearningOperation, emptyLearning, dayKey, streak, quizReviewRows } from '../../../shared/learningState.js'
import { codingHints } from './codingHints.js'
import { generateCodingChallenge } from '../../../shared/generateCodingChallenge.js'

test('goals, bookmarks, quiz activities and resolved reviews survive replay without duplicate counts', () => {
  let state = emptyLearning()
  const attempt = { _id: 'a', createdAt: '2026-10-09', quiz: { _id: 'q', title: 'Basics' }, answers: [{ question: 'one', questionSnapshot: { text: '2 + 2?', options: ['3', '4'], correctAnswer: 1, explanation: 'Add two pairs.' }, selectedOption: '3' }] }
  const rows = quizReviewRows(attempt)
  const op = { id: 'quiz-a', type: 'quiz', data: { attemptId: 'a', day: '2026-10-09', rows } }
  state = applyLearningOperation(state, op)
  state = applyLearningOperation(state, op)
  assert.equal(state.days['2026-10-09'].length, 1)
  assert.equal(Object.values(state.quizMistakes)[0].selectedOption, '3')
  state = applyLearningOperation(state, { id: 'review', type: 'review', data: { key: rows[0].id } })
  assert.equal(state.quizMistakes[rows[0].id].resolved, true)
  state = applyLearningOperation(state, { id: 'goal', type: 'goal', data: { goal: 5 } })
  assert.equal(state.goal, 5)
  state = applyLearningOperation(state, { id: 'b1', type: 'bookmark', data: { key: 'quiz-q', item: { kind: 'quiz', title: 'Basics', quizId: 'q' } } })
  state = applyLearningOperation(state, { id: 'b2', type: 'bookmark', data: { key: 'quiz-q', remove: true } })
  assert.deepEqual(state.bookmarks, {})
  assert.equal(emptyLearning().goal, 3)
})
test('streak spans month boundaries, survives until the next day, and resets after a gap', () => {
  const days = { '2026-09-30': ['a'], '2026-10-01': ['b'], '2026-10-02': ['c'] }
  assert.equal(streak(days, '2026-10-02'), 3)
  assert.equal(streak(days, '2026-10-03'), 3)
  assert.equal(streak(days, '2026-10-04'), 0)
  assert.match(dayKey(), /^\d{4}-\d{2}-\d{2}$/)
})
test('coding progress merges unrelated subjects and successful retries resolve mistakes once', () => {
  const challenge = generateCodingChallenge('programming', 'Easy', 1)
  const data = { challenge, code: 'wrong', day: '2026-10-09', results: [{ name: 'Case 1', passed: false, actual: 0 }], progress: { subjectId: challenge.subjectId, difficulty: 'Easy', passed: 0, total: 3, score: 0, tested: true, status: 'In progress' } }
  let state = applyLearningOperation(emptyLearning(), { id: 'fail', type: 'coding', data })
  assert.equal(state.mistakes.length, 1)
  assert.deepEqual(state.days, {})
  state = applyLearningOperation(state, { id: 'pass', type: 'coding', data: { ...data, code: 'fixed', results: [{ name: 'Case 1', passed: true }], progress: { ...data.progress, passed: 3, score: 40, status: 'Completed' } } })
  assert.equal(state.mistakes[0].resolved, true)
  assert.equal(state.mistakes[0].code, 'wrong')
  assert.equal(state.days['2026-10-09'].length, 1)
  state = applyLearningOperation(state, { id: 'import', type: 'import', data: { progress: { other: { score: 10 }, 'programming-Easy': { score: 0 } }, mistakes: [] } })
  assert.equal(state.progress['programming-Easy'].score, 40)
  assert.equal(state.progress.other.score, 10)
})
test('hints are available for every subject without exposing reference code', () => {
  for (const subject of ['programming', 'javascript', 'python', 'java', 'html', 'css', 'sql']) {
    const challenge = generateCodingChallenge(subject, 'Easy', 1)
    const hints = codingHints(challenge)
    assert.equal(hints.length, 3)
    assert.ok(hints.every(hint => typeof hint === 'string' && hint.length > 20))
    assert.ok(!hints.join(' ').includes(challenge.solution))
  }
})
