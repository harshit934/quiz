import { assertValidQuestionBatch } from './questionBatch.js'

const QUESTION_TARGETS = Object.freeze({ Easy: 5, Medium: 10, Hard: 15 })

function textKey(text) {
  return String(text ?? '').trim().toLowerCase()
}

function idOf(value) {
  return String(value?._id ?? value?.id ?? value)
}

function quizCategorySlug(quiz) {
  return quiz.categorySlug ?? quiz.category?.slug ?? quiz.category
}

function getNextPosition(questions) {
  const positions = questions
    .map(question => question.position)
    .filter(position => Number.isInteger(position) && position >= 0)

  return positions.length ? Math.max(...positions) + 1 : questions.length
}

function resolveQuiz(batchQuiz, matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error(`No quiz found for category "${batchQuiz.categorySlug}" and title "${batchQuiz.title}".`)
  }
  const exactMatches = matches.filter(quiz => quiz.difficulty === batchQuiz.difficulty)
  if (exactMatches.length > 1) {
    throw new Error(`Quiz identity for category "${batchQuiz.categorySlug}", title "${batchQuiz.title}", and difficulty "${batchQuiz.difficulty}" is ambiguous (${exactMatches.length} matches).`)
  }

  if (!exactMatches.length) {
    if (matches.length === 1) {
      throw new Error(`Difficulty mismatch for "${batchQuiz.title}": batch says ${batchQuiz.difficulty}, quiz is ${matches[0].difficulty}.`)
    }
    throw new Error(`No unique quiz matches category "${batchQuiz.categorySlug}", exact title "${batchQuiz.title}", and difficulty "${batchQuiz.difficulty}".`)
  }

  const quiz = exactMatches[0]
  if (quiz.title !== batchQuiz.title || quizCategorySlug(quiz) !== batchQuiz.categorySlug) {
    throw new Error(`Repository returned a quiz that does not match category "${batchQuiz.categorySlug}" and exact title "${batchQuiz.title}".`)
  }
  if (quiz._id == null && quiz.id == null) {
    throw new Error(`Resolved quiz "${batchQuiz.title}" has no database identifier.`)
  }
  return quiz
}

export async function importQuestionBatch({ batch, repository }) {
  assertValidQuestionBatch(batch)
  for (const method of ['findQuizzes', 'findQuestions', 'insertQuestions', 'updateQuizQuestions']) {
    if (typeof repository?.[method] !== 'function') {
      throw new TypeError(`Question batch repository must implement ${method}().`)
    }
  }

  const resolved = []

  for (const batchQuiz of batch.quizzes) {
    const quiz = resolveQuiz(batchQuiz, await repository.findQuizzes({
      categorySlug: batchQuiz.categorySlug,
      title: batchQuiz.title,
    }))
    const existingQuestions = await repository.findQuestions(idOf(quiz))
    if (!Array.isArray(existingQuestions)) {
      throw new TypeError(`Repository findQuestions() must return an array for "${batchQuiz.title}".`)
    }

    const existingText = new Set(existingQuestions.map(question => textKey(question.text)))
    const newQuestions = batchQuiz.questions.filter(question => !existingText.has(textKey(question.text)))
    const target = QUESTION_TARGETS[quiz.difficulty]
    const capacity = target - existingQuestions.length
    if (capacity < 0) {
      throw new Error(`Quiz "${batchQuiz.title}" already has ${existingQuestions.length} questions, above its ${target}-question target.`)
    }
    if (newQuestions.length > capacity) {
      throw new Error(`Batch would exceed the ${target}-question target for "${batchQuiz.title}": ${existingQuestions.length} existing plus ${newQuestions.length} new.`)
    }

    resolved.push({ batchQuiz, quiz, existingQuestions, newQuestions })
  }

  const results = []
  for (const item of resolved) {
    const { batchQuiz, quiz, existingQuestions, newQuestions } = item
    const nextPosition = getNextPosition(existingQuestions)
    const documents = newQuestions.map((question, index) => ({
      quiz: idOf(quiz),
      text: question.text,
      options: [...question.options],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      position: nextPosition + index,
    }))
    const inserted = documents.length
      ? await repository.insertQuestions(idOf(quiz), documents)
      : []
    if (!Array.isArray(inserted) || inserted.length !== documents.length) {
      throw new Error(`Repository inserted ${inserted?.length ?? 0} of ${documents.length} questions for "${batchQuiz.title}".`)
    }

    const referencedIds = new Set([
      ...(Array.isArray(quiz.questions) ? quiz.questions.map(idOf) : []),
      ...existingQuestions.map(question => idOf(question._id ?? question.id)),
      ...inserted.map(question => idOf(question._id ?? question.id)),
    ])
    const questionIds = [...referencedIds]
    await repository.updateQuizQuestions(idOf(quiz), questionIds, questionIds.length)

    results.push({
      categorySlug: batchQuiz.categorySlug,
      title: batchQuiz.title,
      difficulty: batchQuiz.difficulty,
      inserted: inserted.length,
      skippedDuplicates: batchQuiz.questions.length - newQuestions.length,
      totalQuestions: questionIds.length,
    })
  }

  return {
    batchId: batch.batchId,
    insertedQuestionCount: results.reduce((total, item) => total + item.inserted, 0),
    quizzes: results,
  }
}
