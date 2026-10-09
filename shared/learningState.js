import { updatePracticeMistakes } from './practiceMistakes.js'

export const emptyLearning = () => ({ progress: {}, mistakes: [], bookmarks: {}, days: {}, goal: 3, quizMistakes: {}, operations: [] })
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function streak(days, today = dayKey()) {
  let date = new Date(`${today}T12:00:00Z`), count = 0
  if (!days[today]?.length) date.setUTCDate(date.getUTCDate() - 1)
  while (days[date.toISOString().slice(0, 10)]?.length) { count++; date.setUTCDate(date.getUTCDate() - 1) }
  return count
}
export function quizReviewRows(attempt) {
  return (attempt.answers || []).map((row, i) => {
    const question = row.questionSnapshot?.text ? row.questionSnapshot : row.question
    if (!question?.text || !Array.isArray(question.options) || !Number.isInteger(question.correctAnswer)) return null
    return { id: `${attempt.quiz?._id || attempt.quiz || attempt.quizSnapshot?.title}-${row.question?.id || row.question?._id || (typeof row.question === 'string' ? row.question : question.text) || i}`, title: attempt.quiz?.title || attempt.quizSnapshot?.title || 'Quiz', question, selectedOption: row.selectedOption || '', resolved: row.selectedOption === question.options[question.correctAnswer] }
  }).filter(Boolean)
}
export function applyLearningOperation(state, op) {
  const next = structuredClone({ ...emptyLearning(), ...state })
  if (next.operations.includes(op.id)) return next
  next.operations = [...next.operations, op.id].slice(-2000)
  const data = op.data
  if (op.type === 'bookmark' && ['__proto__', 'constructor', 'prototype'].includes(data.key)) return next
  if (op.type === 'goal') next.goal = data.goal
  if (op.type === 'bookmark') {
    if (data.remove) delete next.bookmarks[data.key]
    else next.bookmarks[data.key] = data.item
  }
  if (op.type === 'coding') {
    next.progress[`${data.challenge.subjectId}-${data.challenge.difficulty}`] = data.progress
    next.mistakes = updatePracticeMistakes(next.mistakes, data.challenge, data.code, data.results)
    if (data.results.length && data.results.every(row => row.passed)) addActivity(next, data.day, `coding-${data.challenge.id}`)
  }
  if (op.type === 'quiz') {
    addActivity(next, data.day, `quiz-${data.attemptId}`)
    for (const row of data.rows) {
      if (!row.resolved) { delete next.quizMistakes[row.id]; next.quizMistakes[row.id] = row }
      else if (next.quizMistakes[row.id]) next.quizMistakes[row.id].resolved = true
    }
  }
  if (op.type === 'review') {
    if (next.quizMistakes[data.key]) next.quizMistakes[data.key].resolved = true
  }
  if (op.type === 'import') {
    for (const [key, value] of Object.entries(data.progress || {})) if (!['__proto__', 'constructor', 'prototype'].includes(key) && !next.progress[key]) next.progress[key] = value
    for (const item of data.mistakes || []) if (!next.mistakes.some(row => row.challenge.id === item.challenge.id)) next.mistakes.push(item)
    next.mistakes = next.mistakes.slice(0, 50)
  }
  next.quizMistakes = Object.fromEntries(Object.entries(next.quizMistakes).slice(-200))
  return next
}
function addActivity(state, day, id) {
  state.days[day] = [...new Set([...(state.days[day] || []), id])].slice(-1000)
  state.days = Object.fromEntries(Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b)).slice(-366))
}
