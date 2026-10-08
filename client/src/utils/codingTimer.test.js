import test from 'node:test'
import assert from 'node:assert/strict'
import { timedChallenge, remainingSeconds, clockLabel } from './codingTimer.js'
test('difficulty deadlines and resumed attempts keep their original deadline', () => {
  for (const [difficulty, minutes] of [['Easy', 15], ['Medium', 30], ['Hard', 45]]) {
    const attempt = timedChallenge({ difficulty }, 1000)
    assert.equal(attempt.deadline, 1000 + minutes * 60000)
    assert.equal(timedChallenge(attempt, 900000).deadline, attempt.deadline)
  }
})
test('timer uses elapsed wall time and clamps expired attempts', () => {
  assert.equal(remainingSeconds(60000, 0), 60)
  assert.equal(remainingSeconds(60000, 59500), 1)
  assert.equal(remainingSeconds(60000, 61000), 0)
  assert.equal(clockLabel(900), '15:00')
  assert.equal(clockLabel(0), '00:00')
})
