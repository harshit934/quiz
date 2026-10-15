import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeWeakAreas } from './weakAreas.js'

test('weak areas use verified attempt percentages and resolve topic under its subject', () => {
  const answers = (categoryId, correctCount, total) => Array.from({ length: total }, (_, index) => ({
    selectedOption: index < correctCount ? 'A' : 'B',
    questionSnapshot: { categoryId, options: ['A', 'B'], correctAnswer: 0 },
  }))
  const attempts = [
    { _id: 'attempt-1', quiz: { category: { _id: 'topic-1', name: 'Algebra', slug: 'algebra', parentSlug: 'math', rootSlug: 'math' } }, answers: answers('topic-1', 2, 4) },
    { _id: 'attempt-2', quiz: { category: { _id: 'topic-1', name: 'Algebra', slug: 'algebra', parentSlug: 'math', rootSlug: 'math' } }, answers: answers('topic-1', 3, 4) },
    { _id: 'attempt-3', quiz: { category: { _id: 'topic-2', name: 'Geometry', slug: 'geometry', parentSlug: 'math', rootSlug: 'math' } }, answers: answers('topic-2', 2, 2) },
  ]
  const categories = [
    { _id: 'root-1', name: 'Mathematics', slug: 'math' },
    { _id: 'topic-1', name: 'Algebra', slug: 'algebra', parentSlug: 'math', rootSlug: 'math' },
    { _id: 'topic-2', name: 'Geometry', slug: 'geometry', parentSlug: 'math', rootSlug: 'math' },
  ]
  const quizzes = [{ _id: 'quiz-1', title: 'Algebra basics', category: 'topic-1' }]
  const areas = summarizeWeakAreas(attempts, categories, quizzes)
  assert.deepEqual(areas.map(area => [area.subject, area.topic, area.average, area.attemptCount]), [
    ['Mathematics', 'Algebra', 63, 2],
    ['Mathematics', 'Geometry', 100, 1],
  ])
  assert.equal(areas[0].practiceQuiz.id, 'quiz-1')
})
