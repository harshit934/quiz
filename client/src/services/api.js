const TOKEN_KEY = 'quizly-token'
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getToken()
  if (token && token !== 'demo-session') headers.set('Authorization', `Bearer ${token}`)
  if (options.body) headers.set('Content-Type', 'application/json')

  let response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5000)
  try {
    response = await fetch(`${API_BASE}/api${path}`, { ...options, headers, signal: options.signal || controller.signal })
  } catch (error) {
    error.networkUnavailable = true
    throw error
  } finally {
    window.clearTimeout(timeout)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'The request could not be completed.')
    error.status = response.status
    error.networkUnavailable = response.status >= 500
    throw error
  }
  return data
}

export function isOfflineError(error) {
  return Boolean(error?.networkUnavailable)
}

export function readLocalAttempts() {
  try {
    return JSON.parse(localStorage.getItem('quizly-attempts') || '[]')
  } catch {
    return []
  }
}

export function saveLocalAttempt(attempt) {
  const attempts = readLocalAttempts()
  attempts.unshift(attempt)
  localStorage.setItem('quizly-attempts', JSON.stringify(attempts.slice(0, 100)))
}
