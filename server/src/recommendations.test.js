import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendQuizzes } from './recommendations.js'

const quiz = (id, difficulty, slug = 'javascript', featured = false) => ({
  _id: id,
  title: `Quiz ${id}`,
  difficulty,
  featured,
  category: { name: 'JavaScript', slug, rootSlug: slug },
})

test('recommendations prioritize weak subjects and explain the measured gap', () => {
  const recommendations = recommendQuizzes([
    { percentage: 40, quiz: { _id: 'old', category: { name: 'JavaScript', slug: 'javascript', rootSlug: 'javascript' } } },
    { percentage: 50, quiz: { _id: 'older', category: { name: 'JavaScript', slug: 'javascript', rootSlug: 'javascript' } } },
  ], [quiz('a', 'Easy'), quiz('b', 'Hard', 'history')])

  assert.equal(recommendations.length, 1)
  assert.equal(recommendations[0].quiz._id, 'a')
  assert.match(recommendations[0].reason, /average is 45%/)
  assert.equal(recommendations[0].progress.percentToTarget, 64)
})

test('new learners get an explanatory featured starting recommendation', () => {
  const recommendations = recommendQuizzes([], [quiz('a', 'Easy'), quiz('b', 'Hard', 'history', true)])
  assert.equal(recommendations[0].quiz._id, 'b')
  assert.match(recommendations[0].reason, /starting point/)
  assert.equal(recommendations[0].progress, null)
})

test('recommendations adapt challenge difficulty to recent performance', () => {
  const recommendations = recommendQuizzes([
    { percentage: 95, quiz: { _id: 'old', category: { name: 'JavaScript', slug: 'javascript', rootSlug: 'javascript' } } },
  ], [quiz('easy', 'Easy'), quiz('hard', 'Hard')])
  assert.equal(recommendations[0].quiz.difficulty, 'Hard')
})
