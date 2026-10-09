import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeProgramLibrary } from './cloudPrograms.js'

test('cloud library prefers current remote data while preserving pending browser edits', () => {
  const remote = { id: 'one', name: 'Remote', code: 'new', revision: 2 }
  assert.equal(mergeProgramLibrary([{ ...remote, code: 'old', revision: 1 }], [remote])[0].code, 'new')
  assert.equal(mergeProgramLibrary([{ ...remote, code: 'offline edit', revision: 1, pending: true }], [remote])[0].code, 'offline edit')
  assert.equal(mergeProgramLibrary([{ id: 'local' }], [remote]).length, 2)
})
