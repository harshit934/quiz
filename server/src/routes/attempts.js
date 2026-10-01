import { Router } from 'express'
import { z } from 'zod'
import Attempt from '../models/Attempt.js'
import Achievement from '../models/Achievement.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import { authenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const submissionSchema = z.object({
  quizId: z.string().min(1),
  answers: z.array(z.object({ questionId: z.string(), selectedOption: z.string().max(180) })).max(100),
  markedQuestionIds: z.array(z.string()).optional().default([]),
  timeTaken: z.number().finite().min(0),
})

const achievements = [
  { code: 'first-quiz', title: 'First steps', detail: 'Complete your first quiz.', goal: 1 },
  { code: 'perfect-score', title: 'Perfect score', detail: 'Earn 100% on a quiz.', goal: 1 },
  { code: 'five-quizzes', title: 'Finding your rhythm', detail: 'Complete five quizzes.', goal: 5 },
  { code: 'ten-quizzes', title: 'Dedicated learner', detail: 'Complete ten quizzes.', goal: 10 },
  { code: 'three-in-a-row', title: 'On a roll', detail: 'Complete three quizzes in a row.', goal: 3 },
  { code: 'category-master', title: 'Category master', detail: 'Complete five quizzes in one category with 80% average.', goal: 5 },
]

async function syncAchievements(userId, attempt, quiz) {
  const history = await Attempt.find({ user: userId }).sort({ createdAt: -1 }).select('percentage quiz')
  const earned = new Set()
  if (history.length >= 1) earned.add('first-quiz')
  if (attempt.percentage === 100) earned.add('perfect-score')
  if (history.length >= 5) earned.add('five-quizzes')
  if (history.length >= 10) earned.add('ten-quizzes')
  if (history.length >= 3) earned.add('three-in-a-row')

  const categoryAttempts = await Attempt.find({ user: userId })
    .populate({ path: 'quiz', match: { category: quiz.category }, select: 'category' })
    .select('percentage quiz')
  const matching = categoryAttempts.filter(item => item.quiz)
  const categoryAverage = matching.length
    ? matching.reduce((sum, item) => sum + item.percentage, 0) / matching.length
    : 0
  if (matching.length >= 5 && categoryAverage >= 80) earned.add('category-master')

  await Promise.all([...earned].map(code => Achievement.updateOne(
    { user: userId, code },
    { $setOnInsert: { user: userId, code, earnedAt: new Date(), progress: 100 } },
    { upsert: true },
  )))
}

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const input = submissionSchema.parse(req.body)
  const quiz = await Quiz.findById(input.quizId)
    .populate('category', 'name')
    .populate({ path: 'questions', options: { sort: { position: 1 } } })
  if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
  if (!quiz.questions.length) return res.status(400).json({ message: 'This quiz has no questions yet.' })

  const validIds = new Set(quiz.questions.map(question => String(question._id)))
  const submitted = new Map()
  for (const answer of input.answers) {
    if (!validIds.has(answer.questionId)) return res.status(400).json({ message: 'An answer does not belong to this quiz.' })
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
    if (selectedOption) {
      if (selectedOption === question.options[question.correctAnswer]) correctCount += 1
      else incorrectCount += 1
    }
    return {
      question: question._id,
      selectedOption,
      questionSnapshot: {
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      },
    }
  })
  const unansweredCount = quiz.questions.length - correctCount - incorrectCount
  const percentage = Math.round((correctCount / quiz.questions.length) * 100)
  const timeTaken = Math.min(Math.round(input.timeTaken), quiz.timeLimit * 60)
  const attempt = await Attempt.create({
    user: req.user._id,
    quiz: quiz._id,
    quizSnapshot: {
      title: quiz.title,
      category: quiz.category?.name || '',
      difficulty: quiz.difficulty,
      totalQuestions: quiz.questions.length,
    },
    answers,
    markedQuestions: input.markedQuestionIds.filter(id => validIds.has(id)),
    score: correctCount,
    percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    timeTaken,
    passed: percentage >= 60,
  })
  await Quiz.updateOne({ _id: quiz._id }, { $inc: { attemptsCount: 1 } })
  await syncAchievements(req.user._id, attempt, quiz)
  const result = await Attempt.findById(attempt._id)
    .populate({ path: 'quiz', populate: { path: 'category', select: 'name slug' } })
    .populate({ path: 'answers.question', select: 'text options correctAnswer explanation position' })
    .populate('markedQuestions', 'text')
  res.status(201).json(result)
}))

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id })
    .populate({ path: 'quiz', select: 'title category difficulty totalQuestions', populate: { path: 'category', select: 'name slug' } })
    .sort({ createdAt: -1 }).limit(100).lean()
  res.json(attempts)
}))

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id }
  if (req.user.role !== 'admin') filter.user = req.user._id
  const attempt = await Attempt.findOne(filter)
    .populate('user', 'name')
    .populate({ path: 'quiz', populate: { path: 'category', select: 'name slug' } })
    .populate({ path: 'answers.question', select: 'text options correctAnswer explanation position' })
    .populate('markedQuestions', 'text')
  if (!attempt) return res.status(404).json({ message: 'Quiz result not found.' })
  res.json(attempt)
}))

export { achievements }
export default router