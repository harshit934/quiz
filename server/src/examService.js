export function getExamStatus(exam, now = new Date()) {
  if (['draft', 'cancelled', 'completed'].includes(exam.status)) return exam.status
  if (now >= new Date(exam.endTime)) return 'completed'
  if (now >= new Date(exam.startTime)) return 'live'
  return exam.status === 'published' ? 'published' : 'scheduled'
}

export function scoreExamAttempt({ questions, answers, passingPercentage, startedAt, submittedAt, maxTimeSeconds = Infinity }) {
  const answerByQuestion = new Map(answers.map(answer => [String(answer.question), answer.selectedOption || '']))
  let correctAnswers = 0
  let wrongAnswers = 0
  let unanswered = 0

  for (const question of questions) {
    const selected = answerByQuestion.get(String(question.question)) || ''
    if (!selected) unanswered += 1
    else if (selected === question.options[question.correctAnswer]) correctAnswers += 1
    else wrongAnswers += 1
  }

  const totalMarks = questions.length
  const percentage = totalMarks ? Math.round(correctAnswers / totalMarks * 100) : 0
  return {
    score: correctAnswers,
    totalMarks,
    percentage,
    correctAnswers,
    wrongAnswers,
    unanswered,
    passed: percentage >= passingPercentage,
    timeTaken: Math.min(maxTimeSeconds, Math.max(0, Math.floor((new Date(submittedAt) - new Date(startedAt)) / 1000))),
  }
}

export function getRemainingSeconds(startedAt, durationMinutes, now = new Date(), endTime = null) {
  const durationSeconds = durationMinutes * 60
  const untilExamEnds = endTime
    ? Math.max(0, Math.floor((new Date(endTime) - new Date(startedAt)) / 1000))
    : durationSeconds
  const availableSeconds = Math.min(durationSeconds, untilExamEnds)
  return Math.max(0, availableSeconds - Math.floor((now - new Date(startedAt)) / 1000))
}
