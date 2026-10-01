import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import Category from '../models/Category.js'
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const questionInput = z.object({
  text: z.string().trim().min(5).max(500),
  options: z.array(z.string().trim().min(1).max(180)).length(4)
    .refine(options => new Set(options.map(option => option.toLowerCase())).size === 4, 'Answer options must be unique.'),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().trim().max(500).optional().default(''),
})
const quizInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional().default(''),
  category: z.string().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  timeLimit: z.number().int().min(1).max(180),
  featured: z.boolean().optional().default(false),
  questions: z.array(questionInput).min(1).max(100),
})
const publicSubmission = z.object({
  answers: z.array(z.object({ questionId: z.string(), selectedOption: z.string().max(180) })).max(100),
  markedQuestionIds: z.array(z.string()).optional().default([]),
  timeTaken: z.number().finite().min(0),
})

async function resolveCategory(value) {
  const category = mongoose.isValidObjectId(value)
    ? await Category.findById(value)
    : await Category.findOne({ slug: value })
  if (!category) {
    const error = new Error('Choose a valid category.')
    error.status = 400
    throw error
  }
  return category
}

function toQuestionView(question) {
  return { id: question.id || String(question._id), text: question.text, options: question.options }
}

router.get('/', asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.difficulty && ['Easy', 'Medium', 'Hard'].includes(req.query.difficulty)) filter.difficulty = req.query.difficulty
  if (req.query.category) {
    const category = mongoose.isValidObjectId(req.query.category)
      ? await Category.findById(req.query.category).select('_id')
      : await Category.findOne({ slug: req.query.category }).select('_id')
    if (!category) return res.json([])
    filter.category = category._id
  }
  if (req.query.search) {
    const search = escapeRegex(String(req.query.search).slice(0, 80))
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ]
  }
  const sort = req.query.sort === 'popular' ? { attemptsCount: -1, createdAt: -1 } : { createdAt: -1 }
  const quizzes = await Quiz.find(filter).select('-createdBy -__v').populate('category', 'name slug icon color').sort(sort).lean()
  res.json(quizzes)
}))

router.get('/:id', optionalAuthenticate, asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).select('-createdBy -__v').populate('category', 'name slug icon color').populate({
    path: 'questions',
    select: req.user?.role === 'admin' ? 'text options correctAnswer explanation position' : 'text options position',
    options: { sort: { position: 1 } },
  })
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  res.json({ ...quiz.toObject(), questions: quiz.questions.map(toQuestionView) })
}))

router.post('/:id/submit', asyncHandler(async (req, res) => {
  const input = publicSubmission.parse(req.body)
  const quiz = await Quiz.findById(req.params.id)
    .populate('category', 'name slug icon color')
    .populate({ path: 'questions', options: { sort: { position: 1 } } })
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  if (!quiz.questions.length) return res.status(400).json({ message: 'This quiz has no questions yet.' })

  const questionIds = new Set(quiz.questions.map(question => String(question._id)))
  const submitted = new Map()
  for (const answer of input.answers) {
    if (!questionIds.has(answer.questionId)) return res.status(400).json({ message: 'An answer does not belong to this quiz.' })
    if (submitted.has(answer.questionId)) return res.status(400).json({ message: 'A question has more than one submitted answer.' })
    submitted.set(answer.questionId, answer.selectedOption)
  }
  let correctCount = 0
  let incorrectCount = 0
  const answers = quiz.questions.map(question => {
    const selectedOption = submitted.get(String(question._id)) || ''
    if (selectedOption && !question.options.includes(selectedOption)) {
      const error = new Error('Choose one of the available answers for each question.')
      error.status = 400
      throw error
    }
    if (selectedOption === question.options[question.correctAnswer]) correctCount += 1
    else if (selectedOption) incorrectCount += 1
    return {
      question: {
        id: String(question._id),
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      },
      selectedOption,
    }
  })
  const unansweredCount = answers.length - correctCount - incorrectCount
  const percentage = Math.round((correctCount / answers.length) * 100)
  res.json({
    quiz: { _id: quiz.id, title: quiz.title, category: quiz.category, difficulty: quiz.difficulty, totalQuestions: quiz.totalQuestions },
    quizSnapshot: { title: quiz.title, category: quiz.category?.name || '', difficulty: quiz.difficulty, totalQuestions: answers.length },
    answers,
    markedQuestions: input.markedQuestionIds.filter(id => questionIds.has(id)),
    score: correctCount,
    percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    timeTaken: Math.min(Math.round(input.timeTaken), quiz.timeLimit * 60),
    passed: percentage >= 60,
    createdAt: new Date(),
  })
}))

router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = quizInput.parse(req.body)
  const category = await resolveCategory(input.category)
  const quiz = await Quiz.create({ ...input, category: category._id, questions: [], totalQuestions: input.questions.length, createdBy: req.user._id })
  try {
    const questions = await Question.insertMany(input.questions.map((question, position) => ({ ...question, quiz: quiz._id, position })))
    quiz.questions = questions.map(question => question._id)
    await quiz.save()
  } catch (error) {
    await Quiz.findByIdAndDelete(quiz._id)
    throw error
  }
  res.status(201).json(await Quiz.findById(quiz._id).populate('category', 'name slug icon color'))
}))

router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = quizInput.parse(req.body)
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  const category = await resolveCategory(input.category)
  const questions = await Question.insertMany(input.questions.map((question, position) => ({ ...question, quiz: quiz._id, position })))
  await Question.deleteMany({ _id: { $in: quiz.questions } })
  Object.assign(quiz, {
    title: input.title,
    description: input.description,
    category: category._id,
    difficulty: input.difficulty,
    timeLimit: input.timeLimit,
    featured: input.featured,
    questions: questions.map(question => question._id),
    totalQuestions: questions.length,
  })
  await quiz.save()
  res.json(await Quiz.findById(quiz._id).populate('category', 'name slug icon color'))
}))

router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id)
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  await Question.deleteMany({ quiz: quiz._id })
  res.json({ message: 'Quiz deleted.' })
}))

router.post('/:id/questions', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  const input = questionInput.parse(req.body)
  const question = await Question.create({ ...input, quiz: quiz._id, position: quiz.questions.length })
  quiz.questions.push(question._id)
  quiz.totalQuestions = quiz.questions.length
  await quiz.save()
  res.status(201).json(toQuestionView(question))
}))

router.put('/:id/questions/:questionId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = questionInput.parse(req.body)
  const question = await Question.findOneAndUpdate({ _id: req.params.questionId, quiz: req.params.id }, input, { new: true, runValidators: true })
  if (!question) return res.status(404).json({ message: 'Question not found.' })
  res.json(toQuestionView(question))
}))

router.delete('/:id/questions/:questionId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  const question = await Question.findOneAndDelete({ _id: req.params.questionId, quiz: quiz._id })
  if (!question) return res.status(404).json({ message: 'Question not found.' })
  quiz.questions.pull(question._id)
  quiz.totalQuestions = quiz.questions.length
  await quiz.save()
  res.json({ message: 'Question deleted.' })
}))

export default router