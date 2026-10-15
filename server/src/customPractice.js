export async function createPrivatePracticeQuiz({
  QuizModel,
  QuestionModel,
  user,
  questions,
  category,
  difficulty,
  title,
  description,
}) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 100) {
    const error = new Error('A practice quiz must contain between 1 and 100 questions.')
    error.status = 400
    throw error
  }
  if (!category || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    const error = new Error('Practice questions need a valid subject and difficulty.')
    error.status = 400
    throw error
  }
  const quiz = await QuizModel.create({
    title,
    description,
    category,
    difficulty,
    timeLimit: Math.max(1, Math.ceil(questions.length * 1.5)),
    questions: [],
    totalQuestions: questions.length,
    createdBy: user,
    isPrivate: true,
  })
  try {
    const copiedQuestions = await QuestionModel.insertMany(questions.map((question, position) => ({
      quiz: quiz._id,
      sourceCategory: question.sourceCategory || question.categoryId || question.quiz?.category?._id || category,
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      position,
    })))
    quiz.questions = copiedQuestions.map(question => question._id)
    await quiz.save()
    return quiz
  } catch (error) {
    await QuestionModel.deleteMany({ quiz: quiz._id })
    await QuizModel.deleteOne({ _id: quiz._id, createdBy: user })
    throw error
  }
}
