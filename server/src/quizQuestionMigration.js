import { assertValidQuestionBatch } from './questionBatch.js'
import { getQuizQuestionTarget } from './quizExpansion.js'

function textKey(text) {
  return String(text ?? '').trim().toLowerCase()
}

function quizIdentity(quiz) {
  return JSON.stringify([quiz.categorySlug, quiz.title, quiz.difficulty])
}

function idOf(value) {
  return String(value?._id ?? value?.id ?? value)
}

function nextPosition(questions) {
  const positions = questions
    .map(question => question.position)
    .filter(position => Number.isInteger(position) && position >= 0)
  return positions.length ? Math.max(...positions) + 1 : questions.length
}

function prepareMigration({ quizzes, questions, batches }) {
  if (!Array.isArray(quizzes) || !Array.isArray(questions) || !Array.isArray(batches)) {
    throw new TypeError('Quizzes, questions, and batches must be arrays.')
  }

  const quizzesByIdentity = new Map()
  const existingByQuiz = new Map()
  const candidateByIdentity = new Map()

  for (const quiz of quizzes) {
    if (quiz?._id == null && quiz?.id == null) {
      throw new Error('Every quiz must have a database identifier.')
    }
    if (typeof quiz.categorySlug !== 'string' || !quiz.categorySlug
      || typeof quiz.title !== 'string' || !quiz.title) {
      throw new Error(`Quiz ${idOf(quiz)} has an invalid category or title.`)
    }
    const identity = quizIdentity(quiz)
    if (quizzesByIdentity.has(identity)) {
      throw new Error(`Duplicate quiz identity found for "${quiz.title}" (${quiz.difficulty}).`)
    }
    getQuizQuestionTarget(quiz.difficulty)
    quizzesByIdentity.set(identity, quiz)
    existingByQuiz.set(idOf(quiz), [])
  }

  for (const question of questions) {
    const quizId = idOf(question.quiz)
    if (!existingByQuiz.has(quizId)) continue
    existingByQuiz.get(quizId).push(question)
  }

  for (const batch of batches) {
    assertValidQuestionBatch(batch)
    for (const entry of batch.quizzes) {
      const identity = quizIdentity(entry)
      if (!quizzesByIdentity.has(identity)) {
        throw new Error(`Question batch "${batch.batchId}" contains an unknown quiz: "${entry.title}" (${entry.difficulty}, ${entry.categorySlug}).`)
      }

      const candidates = candidateByIdentity.get(identity) ?? []
      const seen = new Set(candidates.map(question => textKey(question.text)))
      for (const question of entry.questions) {
        const key = textKey(question.text)
        if (!seen.has(key)) {
          candidates.push(question)
          seen.add(key)
        }
      }
      candidateByIdentity.set(identity, candidates)
    }
  }

  const plans = quizzes.map(quiz => {
    const quizId = idOf(quiz)
    const existingQuestions = existingByQuiz.get(quizId)
    const targetCount = getQuizQuestionTarget(quiz.difficulty)
    const oldCount = existingQuestions.length
    const needed = Math.max(targetCount - oldCount, 0)
    const existingTexts = new Set(existingQuestions.map(question => textKey(question.text)))
    const candidates = (candidateByIdentity.get(quizIdentity(quiz)) ?? [])
      .filter(question => !existingTexts.has(textKey(question.text)))

    if (candidates.length < needed) {
      throw new Error(
        `Insufficient unique questions for "${quiz.title}" (${quiz.difficulty}): `
        + `needs ${needed}, batch provides ${candidates.length}. No database changes were made.`,
      )
    }

    return {
      quiz,
      quizId,
      existingQuestions,
      oldCount,
      targetCount,
      questionsToAdd: candidates.slice(0, needed),
    }
  })

  return plans
}

export async function migrateQuizQuestions({ batches, repository }) {
  for (const method of ['listQuizzesAndQuestions', 'insertQuestions', 'updateQuizQuestions', 'countQuestions']) {
    if (typeof repository?.[method] !== 'function') {
      throw new TypeError(`Quiz question migration repository must implement ${method}().`)
    }
  }

  const { quizzes, questions } = await repository.listQuizzesAndQuestions()
  const plans = prepareMigration({ quizzes, questions, batches })
  const report = []

  for (const plan of plans) {
    const { quiz, quizId, existingQuestions, oldCount, targetCount, questionsToAdd } = plan
    const inserted = questionsToAdd.length
      ? await repository.insertQuestions(quizId, questionsToAdd.map((question, index) => ({
        quiz: quizId,
        text: question.text,
        options: [...question.options],
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        position: nextPosition(existingQuestions) + index,
      })))
      : []

    if (!Array.isArray(inserted) || inserted.length !== questionsToAdd.length) {
      throw new Error(`Question insertion count did not match the plan for "${quiz.title}".`)
    }

    const questionIds = [
      ...existingQuestions.map(question => question._id ?? question.id),
      ...inserted.map(question => question._id ?? question.id),
    ]
    const referencedIds = new Set((Array.isArray(quiz.questions) ? quiz.questions : []).map(idOf))
    const needsReferenceSync = questionIds.some(questionId => !referencedIds.has(idOf(questionId)))
      || quiz.totalQuestions !== oldCount + inserted.length
    if (inserted.length || needsReferenceSync) {
      await repository.updateQuizQuestions(quizId, questionIds, oldCount + inserted.length)
    }

    const finalCount = await repository.countQuestions(quizId)
    report.push({
      categorySlug: quiz.categorySlug,
      title: quiz.title,
      difficulty: quiz.difficulty,
      oldCount,
      questionsAdded: inserted.length,
      finalCount,
      targetCount,
    })
  }

  return report
}

export function formatQuizQuestionMigrationReport(report) {
  const rows = report.map(item => [
    item.categorySlug,
    item.title,
    item.difficulty,
    item.oldCount,
    item.questionsAdded,
    item.finalCount,
  ])
  const headers = ['Category', 'Quiz', 'Difficulty', 'Old count', 'Added', 'Final count']
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map(row => String(row[index]).length),
  ))
  const formatRow = row => row.map((value, index) => String(value).padEnd(widths[index])).join(' | ')

  return [
    'Quiz question migration report',
    formatRow(headers),
    widths.map(width => '-'.repeat(width)).join('-+-'),
    ...rows.map(formatRow),
  ].join('\n')
}
