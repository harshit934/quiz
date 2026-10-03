const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard'])
const BATCH_KEYS = new Set(['formatVersion', 'batchId', 'quizzes'])
const QUIZ_KEYS = new Set(['categorySlug', 'title', 'difficulty', 'questions'])
const QUESTION_KEYS = new Set(['text', 'options', 'correctAnswer', 'explanation'])
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizedText(value) {
  return value.trim().toLowerCase()
}

function addUnknownKeyErrors(value, allowedKeys, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push({ path: `${path}.${key}`, message: 'Unknown field.' })
    }
  }
}

export function getQuizBatchIdentityKey({ categorySlug, title, difficulty }) {
  return JSON.stringify([categorySlug, title, difficulty])
}

export function validateQuestionBatch(batch) {
  const errors = []

  if (!isRecord(batch)) {
    return [{ path: '$', message: 'Batch must be a JSON object.' }]
  }

  addUnknownKeyErrors(batch, BATCH_KEYS, '$', errors)
  if (batch.formatVersion !== 1) {
    errors.push({ path: '$.formatVersion', message: 'Must be the number 1.' })
  }
  if (typeof batch.batchId !== 'string'
    || batch.batchId !== batch.batchId.trim()
    || !batch.batchId
    || batch.batchId.length > 100) {
    errors.push({ path: '$.batchId', message: 'Must be a non-empty trimmed string of at most 100 characters.' })
  }
  if (!Array.isArray(batch.quizzes) || batch.quizzes.length === 0) {
    errors.push({ path: '$.quizzes', message: 'Must contain at least one quiz batch.' })
    return errors
  }

  const quizIdentities = new Set()
  const seenTextsByQuiz = new Map()

  batch.quizzes.forEach((quiz, quizIndex) => {
    const quizPath = `$.quizzes[${quizIndex}]`
    if (!isRecord(quiz)) {
      errors.push({ path: quizPath, message: 'Quiz batch must be a JSON object.' })
      return
    }
    addUnknownKeyErrors(quiz, QUIZ_KEYS, quizPath, errors)

    const validSlug = typeof quiz.categorySlug === 'string'
      && quiz.categorySlug === quiz.categorySlug.trim()
      && CATEGORY_SLUG_PATTERN.test(quiz.categorySlug)
    if (!validSlug) {
      errors.push({ path: `${quizPath}.categorySlug`, message: 'Must be a lowercase category slug.' })
    }

    const validTitle = typeof quiz.title === 'string'
      && quiz.title === quiz.title.trim()
      && quiz.title.length > 0
      && quiz.title.length <= 100
    if (!validTitle) {
      errors.push({ path: `${quizPath}.title`, message: 'Must be an exact, non-empty quiz title of at most 100 characters.' })
    }

    if (typeof quiz.difficulty !== 'string' || !DIFFICULTIES.has(quiz.difficulty)) {
      errors.push({ path: `${quizPath}.difficulty`, message: 'Must be Easy, Medium, or Hard.' })
    }

    const identityIsValid = validSlug && validTitle
      && typeof quiz.difficulty === 'string' && DIFFICULTIES.has(quiz.difficulty)
    const identityKey = identityIsValid ? getQuizBatchIdentityKey(quiz) : null
    if (identityKey && quizIdentities.has(identityKey)) {
      errors.push({ path: quizPath, message: 'A quiz identity may appear only once in a batch.' })
    } else if (identityKey) {
      quizIdentities.add(identityKey)
      seenTextsByQuiz.set(identityKey, new Set())
    }

    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      errors.push({ path: `${quizPath}.questions`, message: 'Must contain at least one question.' })
      return
    }

    const seenTexts = identityKey ? seenTextsByQuiz.get(identityKey) : null
    quiz.questions.forEach((question, questionIndex) => {
      const questionPath = `${quizPath}.questions[${questionIndex}]`
      if (!isRecord(question)) {
        errors.push({ path: questionPath, message: 'Question must be a JSON object.' })
        return
      }
      addUnknownKeyErrors(question, QUESTION_KEYS, questionPath, errors)

      const validText = typeof question.text === 'string'
        && question.text === question.text.trim()
        && question.text.length > 0
        && question.text.length <= 500
      if (!validText) {
        errors.push({ path: `${questionPath}.text`, message: 'Must be a non-empty trimmed string of at most 500 characters.' })
      } else if (seenTexts) {
        const textKey = normalizedText(question.text)
        if (seenTexts.has(textKey)) {
          errors.push({ path: `${questionPath}.text`, message: 'Duplicate normalized question text within this quiz.' })
        } else {
          seenTexts.add(textKey)
        }
      }

      if (!Array.isArray(question.options) || question.options.length !== 4) {
        errors.push({ path: `${questionPath}.options`, message: 'Must contain exactly four options.' })
      } else {
        const normalizedOptions = new Set()
        question.options.forEach((option, optionIndex) => {
          if (typeof option !== 'string'
            || option !== option.trim()
            || option.length === 0
            || option.length > 180) {
            errors.push({
              path: `${questionPath}.options[${optionIndex}]`,
              message: 'Must be a non-empty trimmed string of at most 180 characters.',
            })
          } else {
            normalizedOptions.add(normalizedText(option))
          }
        })
        if (normalizedOptions.size !== 4) {
          errors.push({ path: `${questionPath}.options`, message: 'All four options must be unique ignoring case.' })
        }
      }

      if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer > 3) {
        errors.push({ path: `${questionPath}.correctAnswer`, message: 'Must be an integer from 0 to 3.' })
      }

      if (typeof question.explanation !== 'string'
        || question.explanation !== question.explanation.trim()
        || question.explanation.length === 0
        || question.explanation.length > 500) {
        errors.push({ path: `${questionPath}.explanation`, message: 'Must be a non-empty trimmed string of at most 500 characters.' })
      }
    })
  })

  return errors
}

export function assertValidQuestionBatch(batch) {
  const errors = validateQuestionBatch(batch)
  if (errors.length) {
    const error = new Error(`Invalid question batch: ${errors.map(item => `${item.path}: ${item.message}`).join('; ')}`)
    error.name = 'QuestionBatchValidationError'
    error.validationErrors = errors
    throw error
  }
  return batch
}
