import assert from 'node:assert/strict'
import test from 'node:test'
import { flattenSubjectCategories, flattenSubjectQuizzes, subjectGroups } from '../../../shared/subjectCatalog.js'

const expectedSubjects = {
  Science: ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Environmental Science'],
  Technology: ['Programming', 'Web Development', 'AI & Machine Learning', 'Databases', 'Cybersecurity', 'Cloud Computing'],
  Mathematics: ['Arithmetic', 'Algebra', 'Geometry', 'Probability', 'Statistics', 'Calculus'],
  History: ['Ancient History', 'Medieval History', 'Modern History', 'World History', 'Indian History', 'World Wars'],
  Geography: ['Countries & Capitals', 'World Geography', 'Indian Geography', 'Mountains & Rivers', 'Maps & Locations'],
  English: ['Grammar', 'Vocabulary', 'Synonyms & Antonyms', 'Literature', 'Reading Comprehension'],
  Sports: ['Cricket', 'Football', 'Basketball', 'Tennis', 'Olympics', 'Sports Records'],
  Entertainment: ['Movies', 'Anime', 'TV Shows', 'Music', 'Gaming'],
  'General Knowledge': ['Current Affairs', 'Inventions', 'Famous People', 'Organizations', 'World Records'],
  Business: ['Economics', 'Finance', 'Marketing', 'Entrepreneurship', 'Management'],
}

test('subject groups expose every requested major category and subcategory', () => {
  assert.deepEqual(Object.fromEntries(subjectGroups.map(subject => [subject.name, subject.children.filter(child => !child.legacy).map(child => child.name)])), expectedSubjects)
})

test('every subcategory has unique Easy, Medium, and Hard quiz content', () => {
  const quizzes = flattenSubjectQuizzes()
  const questions = quizzes.flatMap(quiz => quiz.questions)
  const questionTexts = questions.map(question => question.text)

  assert.equal(quizzes.length, 54 * 3)
  assert.deepEqual(['Easy', 'Medium', 'Hard'].map(level => quizzes.filter(quiz => quiz.difficulty === level).length), [54, 54, 54])
  assert.equal(new Set(questionTexts).size, questionTexts.length)
  assert.ok(questions.every(question => question.options.length === 4))
  assert.ok(questions.every(question => new Set(question.options).size === 4))
  assert.ok(questions.every(question => Number.isInteger(question.correctAnswer) && question.explanation))
})

test('legacy categories remain attached to their major technology subjects', () => {
  const categories = new Map(flattenSubjectCategories().map(category => [category.slug, category]))

  assert.equal(categories.get('javascript').parentSlug, 'programming')
  assert.equal(categories.get('react').parentSlug, 'web-development')
  assert.equal(categories.get('data-science').rootSlug, 'technology')
})
