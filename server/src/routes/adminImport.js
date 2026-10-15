import { Router } from 'express'
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { importQuestionBatch } from '../questionBatchImporter.js'
import { createMongooseQuestionBatchRepository } from '../mongooseQuestionBatchRepository.js'
import { parseQuestionImportFile } from '../bulkQuestionImport.js'

function normalizedText(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

async function analyzeBatch(batch, repository) {
  const errors = []
  const duplicates = []
  let questionCount = 0
  for (let quizIndex = 0; quizIndex < batch.quizzes.length; quizIndex += 1) {
    const quizBatch = batch.quizzes[quizIndex]
    const identity = { categorySlug: quizBatch.categorySlug, title: quizBatch.title }
    const matches = await repository.findQuizzes(identity)
    if (!matches.length) {
      errors.push({ path: `$.quizzes[${quizIndex}]`, message: 'No quiz matches this category and exact title.' })
      continue
    }
    const difficultyMatches = matches.filter(quiz => quiz.difficulty === quizBatch.difficulty)
    if (difficultyMatches.length !== 1) {
      errors.push({ path: `$.quizzes[${quizIndex}].difficulty`, message: 'Quiz title/category must match exactly one quiz at this difficulty.' })
      continue
    }
    const quiz = difficultyMatches[0]
    const existing = await repository.findQuestions(String(quiz._id || quiz.id))
    const existingText = new Set(existing.map(question => normalizedText(question.text)))
    const repeated = quizBatch.questions.filter(question => existingText.has(normalizedText(question.text)))
    duplicates.push({
      categorySlug: quizBatch.categorySlug,
      title: quizBatch.title,
      difficulty: quizBatch.difficulty,
      questions: repeated.map(question => question.text),
    })
    questionCount += quizBatch.questions.length - repeated.length
  }
  return { errors, duplicates, questionCount }
}

export function createAdminImportRouter({
  auth = authenticate,
  admin = requireAdmin,
  CategoryModel = Category,
  QuizModel = Quiz,
  QuestionModel = Question,
  startSession = () => mongoose.startSession(),
} = {}) {
  const router = Router()
  router.use(auth, admin)

  router.post('/preview', asyncHandler(async (req, res) => {
    const parsed = parseQuestionImportFile(req.body)
    if (parsed.errors.length) {
      return res.json({
        valid: false,
        errors: parsed.errors,
        duplicates: [],
        questionCount: 0,
      })
    }
    const repository = createMongooseQuestionBatchRepository({
      Category: CategoryModel,
      Quiz: QuizModel,
      Question: QuestionModel,
    })
    const analysis = await analyzeBatch(parsed.batch, repository)
    res.json({
      valid: analysis.errors.length === 0,
      errors: analysis.errors,
      duplicates: analysis.duplicates,
      questionCount: analysis.questionCount,
      quizCount: parsed.batch.quizzes.length,
    })
  }))

  router.post('/commit', asyncHandler(async (req, res) => {
    const parsed = parseQuestionImportFile(req.body)
    if (parsed.errors.length) return res.status(422).json({ message: 'Fix the invalid file rows before importing.', errors: parsed.errors })

    const session = await startSession()
    let result
    try {
      await session.withTransaction(async () => {
        const repository = createMongooseQuestionBatchRepository({
          Category: CategoryModel,
          Quiz: QuizModel,
          Question: QuestionModel,
          session,
        })
        const analysis = await analyzeBatch(parsed.batch, repository)
        if (analysis.errors.length) {
          const error = new Error('Quiz data changed after preview. Review the file and preview it again.')
          error.status = 409
          error.details = analysis.errors
          throw error
        }
        result = await importQuestionBatch({ batch: parsed.batch, repository })
      })
    } finally {
      await session.endSession()
    }
    res.status(201).json(result)
  }))

  return router
}

export default createAdminImportRouter()
