import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')
dotenv.config({ path: path.join(projectRoot, '.env') })
const [{ default: app }, { seedStarterContent }] = await Promise.all([
  import('./app.js'),
  import('./seed.js'),
])

const port = Number(process.env.PORT) || 4000

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI)
      console.info('Connected to MongoDB.')
      await seedStarterContent()
    } catch (error) {
      console.error('MongoDB connection failed:', error.message)
    }
  } else {
    console.warn('MONGODB_URI is not configured. API data routes require a database connection.')
  }

  app.listen(port, () => console.info(`Quiz API listening on http://localhost:${port}`))
}

start()