export const QUIZ_QUESTION_TARGETS = Object.freeze({
  Easy: 5,
  Medium: 10,
  Hard: 15,
})

export function getQuizQuestionTarget(difficulty) {
  const normalizedDifficulty = String(difficulty ?? '').trim()
  if (!Object.hasOwn(QUIZ_QUESTION_TARGETS, normalizedDifficulty)) {
    throw new Error(`Unsupported quiz difficulty: ${difficulty}`)
  }
  return QUIZ_QUESTION_TARGETS[normalizedDifficulty]
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeQuestion(question = {}) {
  const normalizedQuestion = { ...question }
  normalizedQuestion._id = question._id ?? question.id ?? null
  normalizedQuestion.quiz = question.quiz ?? question.quizId ?? question.quiz?.id ?? question.quiz?._id ?? null
  normalizedQuestion.text = normalizeText(question.text)
  normalizedQuestion.options = Array.isArray(question.options)
    ? question.options.map(option => normalizeText(option))
    : []
  normalizedQuestion.correctAnswer = Number(question.correctAnswer)
  normalizedQuestion.explanation = normalizeText(question.explanation ?? '')
  normalizedQuestion.category = question.category ?? question.categoryId ?? null
  normalizedQuestion.difficulty = question.difficulty ?? null
  return normalizedQuestion
}

function normalizeQuiz(quiz = {}) {
  return {
    _id: quiz._id ?? quiz.id ?? null,
    title: normalizeText(quiz.title),
    category: quiz.category ?? quiz.categoryId ?? null,
    difficulty: normalizeText(quiz.difficulty),
  }
}

function normalizeTextKey(value) {
  return normalizeText(value).toLowerCase()
}

export function validateQuestionForQuiz(question, quiz, seenTexts = new Set()) {
  const normalizedQuestion = normalizeQuestion(question)
  const normalizedQuiz = normalizeQuiz(quiz)

  if (normalizedQuiz._id && normalizedQuestion.quiz && String(normalizedQuestion.quiz) !== String(normalizedQuiz._id)) {
    throw new Error(`Question belongs to a different quiz than the one being validated.`)
  }

  if (normalizedQuestion.category && normalizedQuiz.category && String(normalizedQuestion.category) !== String(normalizedQuiz.category)) {
    throw new Error('Question category does not match the quiz category.')
  }

  if (normalizedQuestion.difficulty && normalizedQuiz.difficulty && String(normalizedQuestion.difficulty) !== String(normalizedQuiz.difficulty)) {
    throw new Error('Question difficulty does not match the quiz difficulty.')
  }

  if (!normalizedQuestion.text) {
    throw new Error('Question text is required.')
  }

  const textKey = normalizeTextKey(normalizedQuestion.text)
  if (seenTexts.has(textKey)) {
    throw new Error('Duplicate question text within quiz is not allowed.')
  }

  if (!Array.isArray(normalizedQuestion.options) || normalizedQuestion.options.length !== 4) {
    throw new Error('Each question must have exactly 4 options.')
  }

  if (new Set(normalizedQuestion.options.map(option => normalizeTextKey(option))).size !== 4) {
    throw new Error('Each question must have exactly 4 unique options.')
  }

  if (!Number.isInteger(normalizedQuestion.correctAnswer) || normalizedQuestion.correctAnswer < 0 || normalizedQuestion.correctAnswer > 3) {
    throw new Error('Question correctAnswer must be an integer between 0 and 3.')
  }

  if (!normalizedQuestion.explanation) {
    throw new Error('Question explanation is required.')
  }

  seenTexts.add(textKey)
  return normalizedQuestion
}

export function buildExpansionPlan({ quizzes = [], questions = [], targets = QUIZ_QUESTION_TARGETS }) {
  const planByQuiz = []
  let totalCurrentQuestions = 0
  let totalMissingQuestions = 0
  let totalTargetQuestions = 0

  for (const quiz of quizzes) {
    const normalizedQuiz = normalizeQuiz(quiz)
    const targetQuestionCount = getQuizQuestionTarget(normalizedQuiz.difficulty)
    const validQuestionIds = []
    const seenTexts = new Set()
    const issues = []

    for (const question of questions) {
      const normalizedQuestion = normalizeQuestion(question)
      const isForThisQuiz = String(normalizedQuestion.quiz ?? '') === String(normalizedQuiz._id ?? '')
      if (!isForThisQuiz) continue

      try {
        validateQuestionForQuiz(normalizedQuestion, normalizedQuiz, seenTexts)
        validQuestionIds.push(String(normalizedQuestion._id ?? normalizedQuestion.id ?? ''))
      } catch (error) {
        issues.push({
          questionId: normalizedQuestion._id ?? normalizedQuestion.id ?? null,
          text: normalizedQuestion.text,
          error: error.message,
        })
      }
    }

    const currentQuestionCount = validQuestionIds.length
    const missingQuestionCount = Math.max(targetQuestionCount - currentQuestionCount, 0)

    totalCurrentQuestions += currentQuestionCount
    totalMissingQuestions += missingQuestionCount
    totalTargetQuestions += targetQuestionCount

    planByQuiz.push({
      quizId: normalizedQuiz._id,
      title: normalizedQuiz.title,
      categoryId: normalizedQuiz.category,
      difficulty: normalizedQuiz.difficulty,
      currentQuestionCount,
      targetQuestionCount,
      missingQuestionCount,
      validQuestionIds,
      issues,
    })
  }

  return {
    targetQuestionsByDifficulty: { ...targets },
    totalQuizzes: quizzes.length,
    totalCurrentQuestions,
    totalTargetQuestions,
    totalMissingQuestions,
    quizzes: planByQuiz,
  }
}

export async function applyQuizQuestionExpansion({
  quizzes = [],
  questions = [],
  questionFactory = async () => [],
  questionRepository = { createMany: async () => [] },
  quizRepository = { updateOne: async () => null },
  dryRun = false,
  targets = QUIZ_QUESTION_TARGETS,
}) {
  const plan = buildExpansionPlan({ quizzes, questions, targets })

  if (dryRun) {
    return { ...plan, dryRun: true, insertedQuestionCount: 0 }
  }

  let insertedQuestionCount = 0

  for (const quizPlan of plan.quizzes) {
    if (quizPlan.missingQuestionCount <= 0) continue

    const quiz = quizzes.find(item => String(item._id ?? item.id) === String(quizPlan.quizId))
    if (!quiz) continue

    const existingTexts = new Set(
      questions
        .filter(question => String(question.quiz ?? question.quizId ?? question.quiz?._id ?? '') === String(quizPlan.quizId))
        .map(question => normalizeTextKey(question.text))
    )

    const factoryResult = await questionFactory({
      quiz,
      missingQuestionCount: quizPlan.missingQuestionCount,
      plan,
      existingQuestionTextSet: existingTexts,
    })

    const generatedQuestions = Array.isArray(factoryResult) ? factoryResult : []
    const candidates = []

    for (const candidate of generatedQuestions) {
      try {
        validateQuestionForQuiz(candidate, quiz, new Set([...existingTexts, ...candidates.map(item => normalizeTextKey(item.text))]))
        candidates.push(candidate)
      } catch (error) {
        quizPlan.issues.push({
          questionId: candidate?._id ?? candidate?.id ?? null,
          text: normalizeText(candidate?.text),
          error: error.message,
        })
      }

      if (candidates.length >= quizPlan.missingQuestionCount) break
    }

    if (!candidates.length) continue

    const createdQuestions = await questionRepository.createMany(candidates.map(question => ({
      ...question,
      quiz: quiz._id,
      category: quiz.category,
      difficulty: quiz.difficulty,
      text: normalizeText(question.text),
      options: question.options.map(option => normalizeText(option)),
      correctAnswer: Number(question.correctAnswer),
      explanation: normalizeText(question.explanation ?? ''),
    })))

    if (!createdQuestions.length) continue

    const nextQuestionIds = Array.from(new Set([
      ...((Array.isArray(quiz.questions) ? quiz.questions : []).map(id => String(id))),
      ...createdQuestions.map(item => String(item._id ?? item.id)),
    ]))

    if (typeof quizRepository.updateOne === 'function') {
      await quizRepository.updateOne(String(quiz._id), nextQuestionIds)
    }

    insertedQuestionCount += createdQuestions.length
  }

  return { ...plan, dryRun: false, insertedQuestionCount }
}
