import assert from 'node:assert/strict'
import test from 'node:test'
import { quizExperience, summarizeGamification } from './gamification.js'

test('verified quiz XP rules award a score-based first-completion amount', () => {
  assert.equal(quizExperience(0), 10)
  assert.equal(quizExperience(59), 15)
  assert.equal(quizExperience(60), 21)
  assert.equal(quizExperience(100), 25)
})

test('gamification summary reports level, UTC streak and weekly challenge progress', () => {
  const now = new Date('2026-10-15T12:00:00.000Z')
  const summary = summarizeGamification(
    [{ xp: 125 }],
    [
      { createdAt: new Date('2026-10-15T09:00:00.000Z'), quiz: 'quiz-1' },
      { createdAt: new Date('2026-10-14T09:00:00.000Z'), quiz: 'quiz-2' },
      { createdAt: new Date('2026-10-13T09:00:00.000Z'), quiz: 'quiz-3' },
    ],
    now,
  )
  assert.deepEqual(summary, {
    totalXp: 125,
    level: 2,
    xpIntoLevel: 25,
    xpToNextLevel: 75,
    streakDays: 3,
    challenges: {
      daily: { completed: 1, goal: 1, rewardXp: 5 },
      weekly: { completed: 3, goal: 3, rewardXp: 15 },
    },
  })
})
