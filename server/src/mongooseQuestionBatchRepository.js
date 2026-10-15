export function createMongooseQuestionBatchRepository({ Category, Quiz, Question, session }) {
  for (const [name, model] of Object.entries({ Category, Quiz, Question })) {
    if (!model) throw new TypeError(`${name} model is required.`)
  }

  return {
    async findQuizzes({ categorySlug, title }) {
      const categoryQuery = Category.findOne({ slug: categorySlug }).select('_id slug')
      if (session) categoryQuery.session(session)
      const category = await categoryQuery.lean()
      if (!category) return []

      const quizQuery = Quiz.find({ category: category._id, title })
      if (session) quizQuery.session(session)
      const quizzes = await quizQuery.lean()
      return quizzes.map(quiz => ({ ...quiz, categorySlug: category.slug }))
    },

    async findQuestions(quizId) {
      const query = Question.find({ quiz: quizId }).select('_id quiz text position').sort({ position: 1, _id: 1 })
      if (session) query.session(session)
      return query.lean()
    },

    async insertQuestions(quizId, questions) {
      return Question.insertMany(questions.map(question => ({ ...question, quiz: quizId })), session ? { session } : {})
    },

    async updateQuizQuestions(quizId, questionIds, totalQuestions) {
      const result = await Quiz.updateOne(
        { _id: quizId },
        {
          $addToSet: { questions: { $each: questionIds } },
          $set: { totalQuestions },
        },
        session ? { session } : {},
      )
      if (result.matchedCount !== 1) {
        throw new Error(`Quiz ${quizId} no longer exists while updating question references.`)
      }
    },
  }
}
