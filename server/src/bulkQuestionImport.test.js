import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQuestionImportFile } from './bulkQuestionImport.js'

const headers = 'categorySlug,title,difficulty,text,optionA,optionB,optionC,optionD,correctAnswer,explanation'

test('CSV import parses quoted commas and converts answer keys to zero-based indexes', () => {
  const result = parseQuestionImportFile({
    format: 'csv',
    content: `${headers}\nscience,Science basics,Easy,"Which item, exactly?",A,B,C,D,C,"Reason, with detail"`,
  })
  assert.deepEqual(result.errors, [])
  assert.equal(result.batch.quizzes[0].questions[0].text, 'Which item, exactly?')
  assert.equal(result.batch.quizzes[0].questions[0].correctAnswer, 2)
  assert.equal(result.batch.quizzes[0].questions[0].explanation, 'Reason, with detail')
})

test('CSV import reports malformed records by source row and rejects malformed quoting', () => {
  const invalidAnswer = parseQuestionImportFile({
    format: 'csv',
    content: `${headers}\nscience,Science basics,Easy,Question text,A,B,C,D,Z,Explanation`,
  })
  assert.ok(invalidAnswer.errors.some(error => error.row === 2 && error.path.endsWith('.correctAnswer')))
  assert.throws(() => parseQuestionImportFile({
    format: 'csv',
    content: `${headers}\nscience,Science basics,Easy,"Question text,A,B,C,D,A,Explanation`,
  }), /unclosed quoted field/)
})

test('JSON import rejects invalid batch formats and files above the size limit', () => {
  const malformed = parseQuestionImportFile({ format: 'json', content: '{"formatVersion": 2}' })
  assert.equal(malformed.errors[0].row, null)
  assert.throws(() => parseQuestionImportFile({ format: 'json', content: 'x'.repeat(700_001) }), /smaller than 700 KB/)
})
