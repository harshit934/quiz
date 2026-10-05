import 'dotenv/config'
import dns from 'node:dns'
import mongoose from 'mongoose'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import Category from './models/Category.js'
import Quiz from './models/Quiz.js'
import Question from './models/Question.js'

dns.setServers(['8.8.8.8'])

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const batchPath = path.resolve(
  __dirname,
  '../question-batches/reviewed-batch.json',
)

async function main() {
  const batch = JSON.parse(await fs.readFile(batchPath, 'utf8'))

  if (!Array.isArray(batch.quizzes)) {
    throw new Error('Batch must contain a quizzes array.')
  }

  console.log(`Batch: ${batch.batchId}`)
  console.log(`Quiz entries: ${batch.quizzes.length}`)

  await mongoose.connect(process.env.MONGODB_URI)

  console.log('MongoDB connected.')

  const categories = await Category.find().lean()
  const categoryBySlug = new Map(
    categories.map(category => [category.slug, category]),
  )

  let createdQuizzes = 0
  let updatedQuizzes = 0
  let insertedQuestions = 0
  let deletedQuestions = 0

  for (const item of batch.quizzes) {
    const category = categoryBySlug.get(item.categorySlug)

    if (!category) {
      throw new Error(
        `Category not found for slug: ${item.categorySlug}`,
      )
    }

    let quiz = await Quiz.findOne({
      category: category._id,
      title: item.title,
      difficulty: item.difficulty,
    })

    if (!quiz) {
      quiz = await Quiz.create({
        title: item.title,
        description: `${item.title} quiz`,
        category: category._id,
        difficulty: item.difficulty,
        timeLimit:
          item.difficulty === 'Easy'
            ? 7
            : item.difficulty === 'Medium'
              ? 10
              : 15,
        featured: false,
        questions: [],
        totalQuestions: 0,
      })

      createdQuizzes += 1
    } else {
      updatedQuizzes += 1
    }

    const oldQuestions = await Question.find({
      quiz: quiz._id,
    }).select('_id')

    if (oldQuestions.length) {
      await Question.deleteMany({
        quiz: quiz._id,
      })

      deletedQuestions += oldQuestions.length
    }

    const questions = await Question.insertMany(
      item.questions.map((question, position) => ({
        quiz: quiz._id,
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        position,
      })),
    )

    quiz.questions = questions.map(question => question._id)
    quiz.totalQuestions = questions.length

    await quiz.save()

    insertedQuestions += questions.length

    console.log(
      `Imported: ${item.categorySlug} | ${item.difficulty} | ${questions.length} questions`,
    )
  }

  console.log('')
  console.log('===== IMPORT COMPLETE =====')
  console.log(`Quiz entries: ${batch.quizzes.length}`)
  console.log(`Quizzes created: ${createdQuizzes}`)
  console.log(`Quizzes updated: ${updatedQuizzes}`)
  console.log(`Old questions removed: ${deletedQuestions}`)
  console.log(`New questions inserted: ${insertedQuestions}`)

  await mongoose.disconnect()
}

main().catch(async error => {
  console.error('Import failed:', error)
  await mongoose.disconnect()
  process.exit(1)
})