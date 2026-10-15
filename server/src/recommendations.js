const rootSlug = category => category?.rootSlug || category?.parentSlug || category?.slug || ''

export function recommendQuizzes(attempts, quizzes, limit = 5) {
  const areaNames = new Map(quizzes.flatMap(quiz => {
    const category = quiz.category
    const slug = rootSlug(category)
    return category && slug && category.slug === slug ? [[slug, category.name]] : []
  }))
  const areaTotals = new Map()
  for (const attempt of attempts) {
    const category = attempt.quiz?.category
    const slug = rootSlug(category)
    if (!slug) continue
    const current = areaTotals.get(slug) || {
      slug,
      name: areaNames.get(slug) || category.name,
      total: 0,
      count: 0,
    }
    current.total += attempt.percentage
    current.count += 1
    areaTotals.set(slug, current)
  }

  const weakAreas = [...areaTotals.values()]
    .map(area => ({ ...area, average: Math.round(area.total / area.count) }))
    .filter(area => area.average < 70)
    .sort((left, right) => left.average - right.average)
  const recentAverage = attempts.length
    ? Math.round(attempts.slice(0, 5).reduce((total, item) => total + item.percentage, 0) / Math.min(attempts.length, 5))
    : null
  const targetDifficulty = recentAverage === null || recentAverage < 55
    ? 'Easy'
    : recentAverage < 80 ? 'Medium' : 'Hard'
  const recentQuizIds = new Set(attempts.slice(0, 5).map(item => String(item.quiz?._id || item.quiz || '')))

  const rankedQuizzes = quizzes.map(quiz => {
    const slug = rootSlug(quiz.category)
    const weakArea = weakAreas.find(area => area.slug === slug)
    const unattemptedRecently = !recentQuizIds.has(String(quiz._id))
    const difficultyMatches = quiz.difficulty === targetDifficulty
    let reason
    if (!attempts.length) {
      reason = quiz.featured
        ? 'A featured starting point while we learn what you enjoy.'
        : 'A good starting point while we learn what you enjoy.'
    } else if (weakArea) {
      reason = `Build your ${weakArea.name} skills; your recent average is ${weakArea.average}% (target: 70%).`
    } else {
      reason = `Your recent average is ${recentAverage}%; this ${targetDifficulty.toLowerCase()} quiz is a good next challenge.`
    }
    return {
      quiz,
      reason,
      weakArea,
      score: !attempts.length
        ? (quiz.featured ? 100 : 0)
        : (weakArea ? 100 : 0) + (difficultyMatches ? 20 : 0) + (unattemptedRecently ? 10 : 0) + (quiz.featured ? 1 : 0),
    }
  }).filter(item => !attempts.length || !weakAreas.length || item.weakArea)
    .sort((left, right) => right.score - left.score || left.quiz.title.localeCompare(right.quiz.title))

  const selected = rankedQuizzes.length
    ? rankedQuizzes
    : quizzes.map(quiz => ({ quiz, reason: `Try a ${targetDifficulty.toLowerCase()} quiz to strengthen your recent progress.`, score: quiz.difficulty === targetDifficulty ? 1 : 0 }))
      .sort((left, right) => right.score - left.score || left.quiz.title.localeCompare(right.quiz.title))

  return selected.slice(0, limit).map(({ quiz, reason, weakArea }) => ({
    quiz: {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      totalQuestions: quiz.totalQuestions,
      timeLimit: quiz.timeLimit,
      category: quiz.category ? { name: quiz.category.name, slug: quiz.category.slug } : null,
    },
    reason,
    progress: weakArea ? {
      area: weakArea.name,
      average: weakArea.average,
      target: 70,
      percentToTarget: Math.min(100, Math.round(weakArea.average / 70 * 100)),
    } : null,
  }))
}
