export function createMongooseQuizQuestionMigrationRepository({ Category, Quiz, Question }) {
  for (const [name, model] of Object.entries({ Category, Quiz, Question })) {
    if (!model) throw new TypeError(`${name} model is required.`)
  }

  return {
    async listQuizzesAndQuestions() {
      const [categories, quizzes, questions] = await Promise.all([
        Category.find({}).select('_id slug').lean(),
        Quiz.find({}).select('_id title category difficulty questions').lean(),
        Question.find({}).select('_id quiz text position').lean(),
      ])
      const categorySlugs = new Map(categories.map(category => [String(category._id), category.slug]))

      return {
        quizzes: quizzes.map(quiz => ({
          ...quiz,
          categorySlug: categorySlugs.get(String(quiz.category)),
        })),
        questions,
      }
    },

    async insertQuestions(quizId, questions) {
      return Question.insertMany(questions, { ordered: true })
    },

    async updateQuizQuestions(quizId, questionIds, totalQuestions) {
      const result = await Quiz.updateOne(
        { _id: quizId },
        {
          $addToSet: { questions: { $each: questionIds } },
          $set: { totalQuestions },
        },
      )
      if (result.matchedCount !== 1) {
        throw new Error(`Quiz ${quizId} no longer exists while updating question references.`)
      }
    },

    async countQuestions(quizId) {
      return Question.countDocuments({ quiz: quizId })
    },
  }
}
