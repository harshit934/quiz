import { compilerLanguageIds } from '../../../shared/playgroundLanguages.js'

export async function runCompiler({ runtime, code, testCases, playground = false }, env = process.env, fetcher = fetch) {
  if (!env.JUDGE0_URL) throw Object.assign(new Error('Compiler service is not configured. Set JUDGE0_URL on the API server to enable Java, Node.js and Bash.'), { status: 503 })
  const ids = Object.fromEntries(Object.entries(compilerLanguageIds).map(([id, fallback]) => [id, Number(env[`JUDGE0_${id.toUpperCase().replaceAll('-', '_')}_LANGUAGE_ID`] || fallback)]))
  const base = env.JUDGE0_URL.replace(/\/+$/, '')
  const headers = { 'Content-Type': 'application/json', ...(env.JUDGE0_AUTH_TOKEN ? { 'X-Auth-Token': env.JUDGE0_AUTH_TOKEN } : {}), ...(env.JUDGE0_RAPIDAPI_KEY ? { 'X-RapidAPI-Key': env.JUDGE0_RAPIDAPI_KEY } : {}), ...(env.JUDGE0_RAPIDAPI_HOST ? { 'X-RapidAPI-Host': env.JUDGE0_RAPIDAPI_HOST } : {}) }
  const call = async (path, options = {}) => {
    const response = await fetcher(base + path, { ...options, headers, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw Object.assign(new Error('The configured compiler rejected the request. Check its URL, credentials and language IDs.'), { status: 502 })
    return response.json()
  }
  const source = runtime === 'nodejs' && !playground ? `${code}\nPromise.resolve(solve(JSON.parse(require('fs').readFileSync(0, 'utf8')))).then(value => console.log(JSON.stringify(value)));` : code
  return Promise.all(testCases.map(async test => {
    const submission = await call('/submissions?base64_encoded=false', { method: 'POST', body: JSON.stringify({ source_code: source, language_id: ids[runtime], stdin: runtime === 'nodejs' && !playground ? JSON.stringify(test.input) : test.stdin || '', cpu_time_limit: 3, wall_time_limit: 5, memory_limit: 128000, enable_network: false }) })
    if (!submission.token) throw Object.assign(new Error('Compiler did not return a submission token.'), { status: 502 })
    let result
    for (let poll = 0; poll < 40; poll++) {
      result = await call(`/submissions/${encodeURIComponent(submission.token)}?base64_encoded=false&fields=status,stdout,stderr,compile_output,message`)
      if (result.status?.id > 2) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    if (result.status?.id !== 3) return { name: test.name, passed: false, error: String(result.compile_output || result.stderr || result.message || result.status?.description || 'Compiler timed out.').slice(0, 8000) }
    const output = (result.stdout || '').trim()
    let actual = output
    if (!playground && typeof test.expected !== 'string') { try { actual = JSON.parse(output) } catch { /* show the invalid stdout */ } }
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value
    return { name: test.name, actual, passed: JSON.stringify(canonical(actual)) === JSON.stringify(canonical(test.expected)) }
  }))
}

export function validCompilerRequest(body) {
  return body && Object.hasOwn(compilerLanguageIds, body.runtime) && (body.playground === undefined || typeof body.playground === 'boolean') && typeof body.code === 'string' && body.code.length > 0 && body.code.length <= 40000 && Array.isArray(body.testCases) && body.testCases.length > 0 && body.testCases.length <= 10 && body.testCases.every(test => test && typeof test === 'object' && typeof test.name === 'string' && test.name.length <= 100 && 'expected' in test && (test.stdin === undefined || typeof test.stdin === 'string')) && JSON.stringify(body.testCases).length <= 50000
}
