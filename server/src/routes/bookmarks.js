import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import Bookmark from '../models/Bookmark.js'
import Question from '../models/Question.js'
import Quiz from '../models/Quiz.js'
import { authenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { createPrivatePracticeQuiz } from '../customPractice.js'

export function createBookmarksRouter({
  BookmarkModel = Bookmark,
  QuestionModel = Question,
  QuizModel = Quiz,
  auth = authenticate,
} = {}) {
  const router = Router()
  router.use(auth)

  router.get('/', asyncHandler(async (req, res) => {
    const items = await BookmarkModel.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('question', 'text options')
      .populate({ path: 'quiz', select: 'title difficulty category', populate: { path: 'category', select: 'name slug parentSlug _id' } })
      .lean()
    res.json(items.filter(item => item.question && item.quiz).map(item => ({
      id: String(item._id),
      questionId: String(item.question._id),
      quizId: String(item.quiz._id),
      question: { text: item.question.text, options: item.question.options },
      quiz: {
        title: item.quiz.title,
        difficulty: item.quiz.difficulty,
        category: item.quiz.category ? {
          id: String(item.quiz.category._id),
          name: item.quiz.category.name,
          slug: item.quiz.category.slug,
          topic: item.quiz.category.parentSlug ? item.quiz.category.name : '',
        } : null,
      },
      createdAt: item.createdAt,
    })))
  }))

  router.post('/practice', asyncHandler(async (req, res) => {
    const input = z.object({
      questionIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(50),
      questionCount: z.number().int().min(1).max(50).optional(),
      categoryId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
      shuffle: z.boolean().default(true),
    }).strict().parse(req.body)
    const questionIds = [...new Set(input.questionIds)]
    if (questionIds.length !== input.questionIds.length) {
      return res.status(400).json({ message: 'Choose each saved question only once.' })
    }
    if (input.questionCount && input.questionCount > questionIds.length) {
      return res.status(400).json({ message: 'Question count cannot exceed the selected saved questions.' })
    }
    const bookmarks = await BookmarkModel.find({
      user: req.user._id,
      question: { $in: questionIds },
    }).select('question').lean()
    if (bookmarks.length !== questionIds.length) {
      return res.status(403).json({ message: 'Every selected question must be saved to your account.' })
    }
    const sourceQuestions = await QuestionModel.find({ _id: { $in: questionIds } })
      .populate({ path: 'quiz', select: 'category difficulty', populate: { path: 'category', select: 'name' } })
      .lean()
    if (sourceQuestions.length !== questionIds.length || sourceQuestions.some(question => !question.quiz?.category)) {
      return res.status(400).json({ message: 'One or more saved questions are no longer available.' })
    }
    const byId = new Map(sourceQuestions.map(question => [String(question._id), question]))
    let selected = questionIds.map(id => byId.get(id))
    if (input.categoryId) selected = selected.filter(question => String(question.quiz.category._id) === input.categoryId)
    if (input.difficulty) selected = selected.filter(question => question.quiz.difficulty === input.difficulty)
    if (!selected.length) return res.status(400).json({ message: 'No selected saved questions match those filters.' })
    selected = selected.slice(0, input.questionCount || selected.length)
    if (input.shuffle) {
      for (let index = selected.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[selected[index], selected[swapIndex]] = [selected[swapIndex], selected[index]]
      }
    }
    const difficulty = input.difficulty || selected[0].quiz.difficulty
    const title = `Saved questions practice · ${new Date().toISOString().slice(0, 10)}`
    const quiz = await createPrivatePracticeQuiz({
      QuizModel,
      QuestionModel,
      user: req.user._id,
      questions: selected,
      category: selected[0].quiz.category._id,
      difficulty,
      title,
      description: 'A private practice quiz made from your saved questions.',
    })
    res.status(201).json({ id: String(quiz._id), title: quiz.title, questionCount: selected.length })
  }))

  router.get('/:questionId', asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.questionId)) return res.status(404).json({ bookmarked: false })
    const bookmark = await BookmarkModel.exists({ user: req.user._id, question: req.params.questionId })
    res.json({ bookmarked: Boolean(bookmark) })
  }))

  router.put('/:questionId', asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.questionId)) return res.status(404).json({ message: 'Question not found.' })
    const question = await QuestionModel.findById(req.params.questionId).select('quiz')
    if (!question) return res.status(404).json({ message: 'Question not found.' })
    const quiz = await QuizModel.findById(question.quiz).select('_id')
    if (!quiz) return res.status(404).json({ message: 'Question is not part of an available quiz.' })
    try {
      await BookmarkModel.updateOne(
        { user: req.user._id, question: question._id },
        { $setOnInsert: { user: req.user._id, question: question._id, quiz: quiz._id } },
        { upsert: true },
      )
    } catch (error) {
      if (error.code !== 11000) throw error
    }
    res.json({ bookmarked: true })
  }))

  router.delete('/:questionId', asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.questionId)) return res.status(404).json({ message: 'Bookmark not found.' })
    const result = await BookmarkModel.deleteOne({ user: req.user._id, question: req.params.questionId })
    res.json({ deleted: result.deletedCount > 0 })
  }))

  return router
}

export default createBookmarksRouter()
