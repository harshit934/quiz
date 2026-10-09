import test from 'node:test'
import assert from 'node:assert/strict'
import { programFilename, programExtensions } from './programDownload.js'
import { compilerLanguages } from '../../../shared/playgroundLanguages.js'

test('downloads have language extensions and safe filenames', () => {
  assert.equal(programFilename('Greeting', 'cpp'), 'Greeting.cpp')
  assert.equal(programFilename('hello.py', 'python'), 'hello.py')
  assert.equal(programFilename('../bad:name', 'c'), '..-bad-name.c')
  assert.equal(programFilename('CON', 'java'), 'program-CON.java')
  assert.equal(programFilename('', 'javascript'), 'program.js')
  for (const [language] of compilerLanguages) {
    const id = language === 'nodejs' ? 'node-js' : language === 'bash' ? 'cloud-computing' : language
    assert.ok(programExtensions[id], `Missing extension for ${id}`)
  }
})
