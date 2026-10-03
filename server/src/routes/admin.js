import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import User from '../models/User.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import Category from '../models/Category.js'
import Attempt from '../models/Attempt.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { assertValidQuestionBatch } from '../questionBatch.js'
import { getQuizQuestionTarget } from '../quizExpansion.js'
import { createMongooseQuizQuestionMigrationRepository } from '../mongooseQuizQuestionMigrationRepository.js'
import { migrateQuizQuestions } from '../quizQuestionMigration.js'
import { isQuizQuestionMigrationModeEnabled } from '../migrationMode.js'

const router = Router()
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const migrationBatchPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../question-batches/reviewed-batch.json',
)
const migrationTokenHeader = 'x-quiz-question-migration-token'
let reviewedQuestionMigrationRunning = false

function hasValidMigrationToken(candidate, expected) {
  if (typeof candidate !== 'string' || Buffer.byteLength(expected) < 32) return false
  const candidateBuffer = Buffer.from(candidate)
  const expectedBuffer = Buffer.from(expected)
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer)
}

export function createReviewedQuestionMigrationHandler({
  loadBatch = async () => JSON.parse(await readFile(migrationBatchPath, 'utf8')),
  createRepository = () => createMongooseQuizQuestionMigrationRepository({ Category, Quiz, Question }),
  questionModel = Question,
  migration = migrateQuizQuestions,
  getMigrationToken = () => process.env.QUIZ_QUESTION_MIGRATION_TOKEN,
  isMigrationModeEnabled = () => isQuizQuestionMigrationModeEnabled(),
} = {}) {
  return async (req, res) => {
    if (!isMigrationModeEnabled()) {
      return res.status(404).json({ error: 'migration_unavailable' })
    }
    const expectedToken = getMigrationToken()
    if (typeof expectedToken !== 'string' || Buffer.byteLength(expectedToken) < 32) {
      return res.status(404).json({ error: 'migration_unavailable' })
    }
    const suppliedToken = req.get?.(migrationTokenHeader) ?? req.headers?.[migrationTokenHeader]
    if (!hasValidMigrationToken(suppliedToken, expectedToken)) {
      return res.status(403).json({ error: 'migration_not_authorized' })
    }
    if (req.body && Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: 'request_body_not_allowed' })
    }
    if (reviewedQuestionMigrationRunning) {
      return res.status(409).json({ error: 'migration_already_running' })
    }

    reviewedQuestionMigrationRunning = true
    try {
      const batch = await loadBatch()
      assertValidQuestionBatch(batch)
      const repository = createRepository()
      const snapshot = await repository.listQuizzesAndQuestions()
      const quizByIdentity = new Map()
      for (const quiz of snapshot.quizzes) {
        const identity = JSON.stringify([quiz.categorySlug, quiz.title, quiz.difficulty])
        const matches = quizByIdentity.get(identity) ?? []
        matches.push(quiz)
        quizByIdentity.set(identity, matches)
      }

      const plannedBatchQuizzes = []
      const matchedIds = new Set()
      const resultsByIdentity = new Map()
      for (const batchQuiz of batch.quizzes) {
        const identity = JSON.stringify([batchQuiz.categorySlug, batchQuiz.title, batchQuiz.difficulty])
        const matches = quizByIdentity.get(identity) ?? []
        if (matches.length !== 1) {
          return res.status(409).json({ error: 'migration_preflight_failed' })
        }
        const quiz = matches[0]
        const quizId = String(quiz._id ?? quiz.id)
        if (quizId === 'undefined' || matchedIds.has(quizId)) {
          return res.status(409).json({ error: 'migration_preflight_failed' })
        }
        matchedIds.add(quizId)

        const existingQuestions = snapshot.questions.filter(question => (
          String(question.quiz?._id ?? question.quiz?.id ?? question.quiz) === quizId
        ))
        const targetCount = getQuizQuestionTarget(quiz.difficulty)
        const oldCount = existingQuestions.length
        const missingCount = Math.max(targetCount - oldCount, 0)
        const existingTexts = new Set(existingQuestions.map(question => String(question.text ?? '').trim().toLowerCase()))
        const candidates = batchQuiz.questions.filter(question => !existingTexts.has(question.text.trim().toLowerCase()))
        const selected = candidates.slice(0, missingCount)

        for (const question of batchQuiz.questions) {
          const document = new questionModel({ ...question, quiz: quiz._id ?? quiz.id })
          if (document.validateSync()) {
            return res.status(422).json({ error: 'migration_preflight_failed' })
          }
        }
        if (selected.length < missingCount) {
          return res.status(409).json({ error: 'migration_preflight_failed' })
        }

        resultsByIdentity.set(identity, {
          identity,
          title: quiz.title,
          difficulty: quiz.difficulty,
          previousQuestionCount: oldCount,
          questionsAdded: 0,
          finalQuestionCount: oldCount,
          targetQuestionCount: targetCount,
        })
        if (missingCount > 0) {
          plannedBatchQuizzes.push({
            ...batchQuiz,
            questions: selected,
          })
        }
      }

      if (plannedBatchQuizzes.length) {
        const migrationQuizIds = new Set(plannedBatchQuizzes.map(batchQuiz => {
          const identity = JSON.stringify([batchQuiz.categorySlug, batchQuiz.title, batchQuiz.difficulty])
          const quiz = (quizByIdentity.get(identity) ?? [])[0]
          return String(quiz._id ?? quiz.id)
        }))
        const insertedQuestionIdsByQuiz = new Map()
        const scopedRepository = {
          ...repository,
          async listQuizzesAndQuestions() {
            const current = await repository.listQuizzesAndQuestions()
            const allowedQuizzes = current.quizzes.filter(quiz => migrationQuizIds.has(String(quiz._id ?? quiz.id)))
            const allowedIds = new Set(allowedQuizzes.map(quiz => String(quiz._id ?? quiz.id)))
            return {
              quizzes: allowedQuizzes,
              questions: current.questions.filter(question => (
                allowedIds.has(String(question.quiz?._id ?? question.quiz?.id ?? question.quiz))
              )),
            }
          },
          async insertQuestions(quizId, questions) {
            if (!migrationQuizIds.has(String(quizId))) throw new Error('Migration scope violation.')
            const inserted = await repository.insertQuestions(quizId, questions)
            if (inserted.length) {
              insertedQuestionIdsByQuiz.set(
                String(quizId),
                inserted.map(question => question._id ?? question.id),
              )
            }
            return inserted
          },
          async updateQuizQuestions(quizId, _questionIds, totalQuestions) {
            const insertedQuestionIds = insertedQuestionIdsByQuiz.get(String(quizId))
            if (!insertedQuestionIds?.length) {
              throw new Error('Refused a quiz update without newly inserted questions.')
            }
            return repository.updateQuizQuestions(quizId, insertedQuestionIds, totalQuestions)
          },
          async countQuestions(quizId) {
            if (!migrationQuizIds.has(String(quizId))) throw new Error('Migration scope violation.')
            return repository.countQuestions(quizId)
          },
        }
        const migrationReport = await migration({
          batches: [{ ...batch, quizzes: plannedBatchQuizzes }],
          repository: scopedRepository,
        })
        for (const item of migrationReport) {
          const identity = JSON.stringify([item.categorySlug, item.title, item.difficulty])
          const result = resultsByIdentity.get(identity)
          if (!result) return res.status(409).json({ error: 'migration_preflight_failed' })
          result.questionsAdded = item.questionsAdded
          result.finalQuestionCount = item.finalCount
        }
      }

      return res.json({
        results: [...resultsByIdentity.values()].map(({
          title,
          difficulty,
          previousQuestionCount,
          questionsAdded,
          finalQuestionCount,
          targetQuestionCount,
        }) => ({
          title,
          difficulty,
          previousQuestionCount,
          questionsAdded,
          finalQuestionCount,
          targetQuestionCount,
        })),
      })
    } catch (error) {
      console.error('Reviewed question migration failed; details withheld.')
      return res.status(500).json({ error: 'migration_failed' })
    } finally {
      reviewedQuestionMigrationRunning = false
    }
  }
}

router.use(authenticate, requireAdmin)

router.post('/migrations/reviewed-questions', asyncHandler(createReviewedQuestionMigrationHandler()))

router.get('/stats', asyncHandler(async (req, res) => {
  const [users, quizzes, questions, attempts, performance, recentAttempts] = await Promise.all([
    User.countDocuments(),
    Quiz.countDocuments(),
    Question.countDocuments(),
    Attempt.countDocuments(),
    Attempt.aggregate([{ $group: { _id: null, average: { $avg: '$percentage' } } }]),
    Attempt.find().sort({ createdAt: -1 }).limit(8)
      .populate('user', 'name username email')
      .populate({ path: 'quiz', select: 'title category', populate: { path: 'category', select: 'name' } })
      .lean(),
  ])
  res.json({
    users,
    quizzes,
    questions,
    attempts,
    averageScore: Math.round(performance[0]?.average || 0),
    recentAttempts: recentAttempts.filter(item => item.user && item.quiz).map(item => ({
      user: item.user.name,
      username: item.user.username || '',
      email: item.user.email,
      quiz: item.quiz.title,
      category: item.quiz.category?.name,
      score: item.score,
      percentage: item.percentage,
      createdAt: item.createdAt,
    })),
  })
}))

router.get('/users', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').slice(0, 80)
  const safeSearch = escapeRegex(search)
  const filter = search ? { $or: [
    { name: { $regex: safeSearch, $options: 'i' } },
    { username: { $regex: safeSearch, $options: 'i' } },
    { email: { $regex: safeSearch, $options: 'i' } },
  ] } : {}
  const users = await User.find(filter).select('name username email role createdAt').sort({ createdAt: -1 }).limit(100).lean()
  const userIds = users.map(user => user._id)
  const performance = await Attempt.aggregate([
    { $match: { user: { $in: userIds } } },
    { $group: { _id: '$user', attempts: { $sum: 1 }, averageScore: { $avg: '$percentage' } } },
  ])
  const performanceByUser = new Map(performance.map(item => [String(item._id), item]))
  res.json(users.map(user => {
    const stats = performanceByUser.get(String(user._id))
    return {
      _id: user._id,
      name: user.name,
      username: user.username || '',
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      attempts: stats?.attempts || 0,
      averageScore: Math.round(stats?.averageScore || 0),
      lastActivity: stats?.lastActivity || null,
    }
  }))
}))

router.get('/stats/quizzes', asyncHandler(async (req, res) => {
  const [quizzes, performance] = await Promise.all([
    Quiz.find().select('title category difficulty').populate('category', 'name').sort({ title: 1 }).lean(),
    Attempt.aggregate([
      { $group: { _id: '$quiz', attempts: { $sum: 1 }, users: { $addToSet: '$user' }, averageScore: { $avg: '$percentage' } } },
    ]),
  ])
  const performanceByQuiz = new Map(performance.map(item => [String(item._id), item]))
  res.json(quizzes.map(quiz => {
    const stats = performanceByQuiz.get(String(quiz._id))
    return {
      _id: quiz._id,
      title: quiz.title,
      category: quiz.category?.name || 'Uncategorized',
      difficulty: quiz.difficulty,
      attempts: stats?.attempts || 0,
      learners: stats?.users.length || 0,
      averageScore: Math.round(stats?.averageScore || 0),
    }
  }))
}))

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const input = z.object({ role: z.enum(['user', 'admin']) }).parse(req.body)
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found.' })
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })
  if (String(user._id) === String(req.user._id) && input.role !== 'admin') {
    return res.status(409).json({ message: 'You cannot remove your own administrator access.' })
  }
  if (user.role === 'admin' && input.role === 'user' && await User.countDocuments({ role: 'admin' }) < 2) {
    return res.status(409).json({ message: 'At least one administrator account must remain.' })
  }
  user.role = input.role
  await user.save()
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
}))

export default router