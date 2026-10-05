import dotenv from 'dotenv'
import dns from 'node:dns'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')

dotenv.config({ path: path.join(projectRoot, '.env') })

dns.setServers(['8.8.8.8'])

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
    } catch (error) {
      console.error('MongoDB connection failed:', error.message)
    }
  } else {
    console.warn('MONGODB_URI is not configured. API data routes require a database connection.')
  }

  const server = app.listen(port, '0.0.0.0', () =>
    console.info(`Quiz API listening on port ${port}`),
  )

  if (mongoose.connection.readyState === 1) {
    try {
      await seedStarterContent()
      console.info('Starter content seeding complete.')
    } catch (error) {
      console.error('MongoDB seeding failed:', error.message)
    }
  }

  return server
}

start()