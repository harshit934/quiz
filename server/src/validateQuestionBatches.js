import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateQuestionBatch } from './questionBatch.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const files = process.argv.slice(2)

if (!files.length) {
  console.error('Usage: npm run validate:question-batches -- <batch.json> [more-batches.json ...]')
  process.exitCode = 1
} else {
  let invalidCount = 0

  for (const filename of files) {
    const filepath = path.resolve(projectRoot, filename)
    try {
      const contents = await readFile(filepath, 'utf8')
      const batch = JSON.parse(contents.replace(/^\uFEFF/, ''))
      const errors = validateQuestionBatch(batch)
      if (errors.length) {
        invalidCount += 1
        console.error(`INVALID ${filename}`)
        for (const error of errors) console.error(`  ${error.path}: ${error.message}`)
      } else {
        console.info(`VALID ${filename} (${batch.batchId}, ${batch.quizzes.length} quizzes)`)
      }
    } catch (error) {
      invalidCount += 1
      console.error(`INVALID ${filename}: ${error.message}`)
    }
  }

  if (invalidCount) process.exitCode = 1
}
