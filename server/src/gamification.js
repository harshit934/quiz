export function quizExperience(percentage) {
  return 10 + Math.floor(percentage / 10) + (percentage >= 60 ? 5 : 0)
}

function utcDay(value) {
  return new Date(value).toISOString().slice(0, 10)
}

export function summarizeGamification(rewards, attempts, now = new Date()) {
  const today = utcDay(now)
  const dates = [...new Set(attempts.map(attempt => utcDay(attempt.createdAt)))].sort().reverse()
  let cursor = new Date(`${today}T00:00:00.000Z`)
  if (!dates.includes(today)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let streakDays = 0
  for (const date of dates) {
    if (date !== utcDay(cursor)) break
    streakDays += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  const weekStart = new Date(`${today}T00:00:00.000Z`)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  const weekStartDay = utcDay(weekStart)
  const todayCount = new Set(attempts.filter(attempt => utcDay(attempt.createdAt) === today).map(attempt => String(attempt.quiz))).size
  const weekCount = new Set(attempts.filter(attempt => utcDay(attempt.createdAt) >= weekStartDay).map(attempt => String(attempt.quiz))).size
  const totalXp = rewards.reduce((total, reward) => total + reward.xp, 0)
  return {
    totalXp,
    level: Math.floor(totalXp / 100) + 1,
    xpIntoLevel: totalXp % 100,
    xpToNextLevel: 100 - (totalXp % 100),
    streakDays,
    challenges: {
      daily: { completed: Math.min(todayCount, 1), goal: 1, rewardXp: 5 },
      weekly: { completed: Math.min(weekCount, 3), goal: 3, rewardXp: 15 },
    },
  }
}
