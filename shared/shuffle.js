export function fisherYates(items, random = Math.random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function shuffleQuestionOptions(question, random = Math.random) {
  const indexedOptions = question.options.map((text, originalIndex) => ({ text, originalIndex }))
  const shuffledOptions = fisherYates(indexedOptions, random)
  const result = { ...question, options: shuffledOptions.map(option => option.text) }

  if (Number.isInteger(question.correctAnswer)) {
    result.correctAnswer = shuffledOptions.findIndex(option => option.originalIndex === question.correctAnswer)
  }

  return result
}