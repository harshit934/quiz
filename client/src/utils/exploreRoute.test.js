import test from 'node:test'
import assert from 'node:assert/strict'
import { exploreRoute } from './exploreRoute.js'

test('browse buttons navigate to all quizzes when passed a React click event', () => {
  assert.equal(exploreRoute({ type: 'click', target: {} }), '#explore')
  assert.equal(exploreRoute(undefined), '#explore')
  assert.equal(exploreRoute('[object Object]'), '#explore')
  assert.equal(exploreRoute('[object%20Object]'), '#explore')
})
test('subject tiles preserve the selected category slug', () => {
  assert.equal(exploreRoute('technology'), '#explore/technology')
  assert.equal(exploreRoute('web-development'), '#explore/web-development')
})
