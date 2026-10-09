import { runCodingCases } from './codingRunner.js'

function workerRun(data, phase) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./native.worker.js', import.meta.url), { type: 'module' })
    let timer
    const finish = (error, result) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result) }
    timer = setTimeout(() => finish(new Error('Runtime could not load within 60 seconds. Check your connection and try again.')), 60000)
    phase('Loading language runtime…')
    worker.onmessage = ({ data }) => {
      if (data.ready) { clearTimeout(timer); phase('Running test cases…'); timer = setTimeout(() => finish(new Error('Execution exceeded the 3-second limit.')), 3000); return }
      finish(data.error ? new Error(data.error) : null, data)
    }
    worker.onerror = () => finish(new Error('The language runtime could not run. Check your code and connection.'))
    worker.postMessage(data)
  })
}

export function previewDocument(challenge, code) {
  const content = challenge.runtime === 'css' ? `<style>${code}</style>${challenge.scaffold}` : code
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'">${content}`
}

function domRun(challenge, code) {
  const preview = previewDocument(challenge, code)
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-same-origin')
    frame.style.cssText = 'position:fixed;left:-10000px;width:800px;height:600px'
    const timer = setTimeout(() => { frame.remove(); reject(new Error('Preview timed out.')) }, 5000)
    frame.onload = () => {
      try {
        const doc = frame.contentDocument
        const results = challenge.testCases.map(test => {
          const check = test.assertion, elements = doc.querySelectorAll(check.selector)
          const actual = check.count !== undefined ? elements.length : check.property ? (elements[0] ? frame.contentWindow.getComputedStyle(elements[0]).getPropertyValue(check.property) : null) : elements[0]?.textContent.trim()
          const expected = check.count ?? check.value ?? check.text
          return { name: test.name, actual, passed: actual === expected }
        })
        clearTimeout(timer); frame.remove(); resolve({ results, preview })
      } catch (error) { clearTimeout(timer); frame.remove(); reject(error) }
    }
    frame.srcdoc = preview
    document.body.append(frame)
  })
}

export async function runSubjectChallenge(challenge, code, phase = () => {}) {
  if (challenge.runtime === 'javascript') return { results: await runCodingCases(code, challenge.testCases, 3000, challenge.playground) }
  if (['html', 'css'].includes(challenge.runtime)) return domRun(challenge, code)
  if (['java', 'bash', 'nodejs'].includes(challenge.runtime)) {
    phase('Contacting configured compiler…')
    const token = localStorage.getItem('quizly-token')
    const response = await fetch(`${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api/coding/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ runtime: challenge.runtime, code, testCases: challenge.testCases }), signal: AbortSignal.timeout(90000),
    })
    const data = await response.json().catch(() => ({ message: 'Compiler API unavailable. Deploy the updated API and configure JUDGE0_URL to run this language.' }))
    if (!response.ok) throw new Error(data.message || 'Compiler unavailable.')
    return data
  }
  const output = await workerRun({ runtime: challenge.runtime, code, testCases: challenge.testCases, playground: challenge.playground }, phase)
  return challenge.runtime === 'jsx' ? domRun(challenge, output.html) : output
}
