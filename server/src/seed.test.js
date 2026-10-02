import assert from 'node:assert/strict'
import test from 'node:test'
import User from './models/User.js'
import { seedAdminAccount } from './seed.js'

test('environment username provisions a separate administrator account', async () => {
  const originalFindOne = User.findOne
  const originalCreate = User.create
  const created = []
  User.findOne = async () => null
  User.create = async account => {
    created.push(account)
    return { ...account, _id: '507f1f77bcf86cd799439011' }
  }
  try {
    const account = await seedAdminAccount({ username: 'fixture_admin', password: 'test-only-password' })
    assert.equal(account.role, 'admin')
    assert.equal(account.username, 'fixture_admin')
    assert.equal(account.email, 'fixture_admin@quizly.local')
    assert.equal(created.length, 1)
    assert.equal(created[0].password, 'test-only-password')
  } finally {
    User.findOne = originalFindOne
    User.create = originalCreate
  }
})

test('environment username does not promote an existing normal account', async () => {
  const originalFindOne = User.findOne
  const originalCreate = User.create
  const existingUser = { _id: '507f1f77bcf86cd799439012', role: 'user' }
  let createCalled = false
  User.findOne = async query => query.username ? existingUser : null
  User.create = async () => { createCalled = true }
  try {
    const account = await seedAdminAccount({ username: 'fixture_admin', password: 'test-only-password' })
    assert.equal(account, null)
    assert.equal(existingUser.role, 'user')
    assert.equal(createCalled, false)
  } finally {
    User.findOne = originalFindOne
    User.create = originalCreate
  }
})
