import { createHash } from 'node:crypto'
import { validateQuestionBatch } from './questionBatch.js'

const CSV_HEADERS = [
  'categorySlug',
  'title',
  'difficulty',
  'text',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctAnswer',
  'explanation',
]

function parseCsvRows(source) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some(value => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.')
  row.push(cell.trim())
  if (row.some(value => value !== '')) rows.push(row)
  return rows
}

function csvToBatch(source) {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one question row.')
  const headers = rows[0]
  if (new Set(headers).size !== headers.length || headers.join(',') !== CSV_HEADERS.join(',')) {
    throw new Error(`CSV columns must be exactly: ${CSV_HEADERS.join(',')}.`)
  }
  const quizzes = new Map()
  const sourceRows = new Map()
  const rowErrors = []
  rows.slice(1).forEach((values, offset) => {
    const rowNumber = offset + 2
    if (values.length !== headers.length) {
      rowErrors.push({ row: rowNumber, path: '$', message: `Expected ${headers.length} columns; found ${values.length}.` })
      return
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]))
    const correctAnswer = /^[A-D]$/i.test(row.correctAnswer)
      ? row.correctAnswer.toUpperCase().charCodeAt(0) - 65
      : /^\d$/.test(row.correctAnswer)
        ? Number(row.correctAnswer)
        : -1
    const identity = JSON.stringify([row.categorySlug, row.title, row.difficulty])
    if (!quizzes.has(identity)) {
      quizzes.set(identity, {
        categorySlug: row.categorySlug,
        title: row.title,
        difficulty: row.difficulty,
        questions: [],
      })
      sourceRows.set(identity, [])
    }
    quizzes.get(identity).questions.push({
      text: row.text,
      options: [row.optionA, row.optionB, row.optionC, row.optionD],
      correctAnswer,
      explanation: row.explanation,
    })
    sourceRows.get(identity).push(rowNumber)
  })
  return {
    batch: {
      formatVersion: 1,
      batchId: `file-${createHash('sha256').update(source).digest('hex').slice(0, 24)}`,
      quizzes: [...quizzes.values()],
    },
    sourceRows: [...sourceRows.values()],
    rowErrors,
  }
}

export function parseQuestionImportFile({ format, content }) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 700_000) {
    const error = new Error('Import file must be text smaller than 700 KB.')
    error.status = 400
    throw error
  }
  try {
    if (format === 'csv') {
      const parsed = csvToBatch(content)
      const errors = [
        ...parsed.rowErrors,
        ...validateQuestionBatch(parsed.batch).map(error => {
          const match = error.path.match(/^\$\.quizzes\[(\d+)\]\.questions\[(\d+)\]/)
          return { ...error, row: match ? parsed.sourceRows[Number(match[1])]?.[Number(match[2])] || null : null }
        }),
      ]
      return { batch: parsed.batch, errors }
    }
    if (format === 'json') {
      let batch
      try {
        batch = JSON.parse(content)
      } catch {
        const error = new Error('JSON file is not valid JSON.')
        error.status = 400
        throw error
      }
      return {
        batch,
        errors: validateQuestionBatch(batch).map(error => ({ ...error, row: null })),
      }
    }
    const error = new Error('Choose a CSV or JSON import file.')
    error.status = 400
    throw error
  } catch (error) {
    if (!error.status) error.status = 400
    throw error
  }
}
