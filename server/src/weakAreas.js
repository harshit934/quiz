export function summarizeWeakAreas(attempts, categories, quizzes = []) {
  const categoriesById = new Map(categories.map(category => [String(category._id), category]))
  const categoryBySlug = new Map(categories.map(category => [category.slug, category]))
  const totals = new Map()
  for (const attempt of attempts) {
    const answers = attempt.answers || []
    const attemptAreas = new Set()
    for (const answer of answers) {
      const categoryId = String(answer.questionSnapshot?.categoryId || attempt.quiz?.category?._id || '')
      const category = categoriesById.get(categoryId) || attempt.quiz?.category
      const root = category && categoryBySlug.get(category.rootSlug || category.slug)
      const subject = root?.name || category?.name || attempt.quizSnapshot?.category || 'Uncategorized'
      const topic = category?.parentSlug ? category.name : 'General'
      const key = categoryId || `${subject}:${topic}`
      const total = totals.get(key) || {
        categoryId,
        subject,
        topic,
        correctCount: 0,
        questionCount: 0,
        attemptIds: new Set(),
      }
      const snapshot = answer.questionSnapshot
      const correct = Boolean(snapshot?.options?.[snapshot.correctAnswer])
        && answer.selectedOption === snapshot.options[snapshot.correctAnswer]
      total.correctCount += Number(correct)
      total.questionCount += 1
      attemptAreas.add(key)
      totals.set(key, total)
    }
    for (const key of attemptAreas) totals.get(key).attemptIds.add(String(attempt._id))
  }
  return [...totals.values()].map(area => {
    const practiceQuiz = quizzes.find(quiz => String(quiz.category?._id || quiz.category) === area.categoryId)
    const average = Math.round(area.correctCount / area.questionCount * 100)
    return {
      subject: area.subject,
      topic: area.topic,
      categoryId: area.categoryId || null,
      average,
      attemptCount: area.attemptIds.size,
      questionCount: area.questionCount,
      practiceQuiz: practiceQuiz ? { id: String(practiceQuiz._id), title: practiceQuiz.title } : null,
    }
  }).sort((first, second) => first.average - second.average || second.attemptCount - first.attemptCount)
}
