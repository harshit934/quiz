import assert from 'node:assert/strict'
import test from 'node:test'
import { authValidationError } from './authValidation.js'

test('login accepts either an admin username or normal-user email', () => {
  assert.equal(authValidationError({ mode: 'login', identifier: 'fixture_admin', password: 'test-password' }), null)
  assert.equal(authValidationError({ mode: 'login', identifier: 'learner@example.test', password: 'test-password' }), null)
})

test('login rejects an empty identifier', () => {
  assert.equal(authValidationError({ mode: 'login', identifier: '', password: 'test-password' }), 'Enter your email address or username.')
  assert.equal(authValidationError({ mode: 'login', identifier: '   ', password: 'test-password' }), 'Enter your email address or username.')
})

test('registration still requires a valid email address', () => {
  assert.equal(authValidationError({ mode: 'register', name: 'Learner', identifier: 'fixture_admin', password: 'test-password' }), 'Enter a valid email address.')
  assert.equal(authValidationError({ mode: 'register', name: 'Learner', identifier: 'learner@example.test', password: 'test-password' }), null)
})