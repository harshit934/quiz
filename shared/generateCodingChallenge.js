import { codingChallenges } from './codingChallenges.js'
import { nativeChallenge } from './nativeCodingChallenges.js'

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value

// Generate from verified subject templates. Never evaluate learner code here.
export function generateCodingChallenge(subjectId, difficulty, attempt) {
  return nativeChallenge(generateJavaScriptChallenge(subjectId, difficulty, attempt))
}

export function generateJavaScriptChallenge(subjectId, difficulty, attempt) {
  const base = codingChallenges.find(item => item.subjectId === subjectId && item.difficulty === 'Easy')
  if (!base || !['Easy', 'Medium', 'Hard'].includes(difficulty) || !Number.isSafeInteger(attempt) || attempt < 1) throw new Error('Invalid coding attempt')
  const parameter = attempt + 1
  const sample = base.testCases.find(item => item.expected !== null).expected
  let instruction, transform
  if (typeof sample === 'number') {
    instruction = `Multiply each non-null result by ${parameter}, then add ${attempt}. Keep null unchanged.`
    transform = `value === null ? null : value * ${parameter} + ${attempt}`
  } else if (typeof sample === 'boolean') {
    instruction = `Return ${parameter} for a valid password and ${-parameter} for an invalid password.`
    transform = `value ? ${parameter} : ${-parameter}`
  } else if (typeof sample === 'string') {
    instruction = `Prefix the result with "attempt-${attempt}:".`
    transform = `"attempt-${attempt}:" + value`
  } else if (Array.isArray(sample)) {
    instruction = `Rotate each resulting list left by ${parameter} positions (wrap around). Keep empty lists empty.`
    transform = `value.length ? value.slice(${parameter} % value.length).concat(value.slice(0, ${parameter} % value.length)) : []`
  } else {
    instruction = `Return an array of [key, count] pairs sorted by key, multiplying every count by ${parameter}.`
    transform = `Object.keys(value).sort().map(key => [key, value[key] * ${parameter}])`
  }
  const solveBase = new Function(`${base.solution}; return solve;`)()
  const convert = new Function('value', `return ${transform};`)
  // Perturb data while preserving each subject's input shape and constraints.
  const vary = value => {
    if (Array.isArray(value)) return value.map(vary)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'number' ? item + attempt : vary(item)]))
    if (typeof value === 'number') return value + attempt
    if (typeof value === 'string') return value + attempt
    return value
  }
  const inputs = base.testCases.map(item => vary(item.input))
  // Log levels, search queries and HTML characters must retain their semantics.
  if (subjectId === 'node-js') inputs[0] = [`INFO: ready-${attempt}`, `ERROR: failed-${attempt}`]
  if (subjectId === 'react-js') inputs[0] = { items: [`React${attempt}`, `Java${attempt}`], query: 'rea' }
  const process = input => convert(solveBase(input))
  const group = values => {
    const groups = new Map()
    for (const value of values) {
      const key = JSON.stringify(canonical(value))
      if (groups.has(key)) groups.get(key).count++
      else groups.set(key, { value, count: 1 })
    }
    return [...groups.values()]
  }
  const solve = input => difficulty === 'Easy' ? process(input) : difficulty === 'Medium' ? input.map(process) : group(input.map(process))
  const cases = difficulty === 'Easy' ? inputs : [inputs, [], [inputs[0], inputs[1], inputs[0]], [inputs[2], inputs[0], inputs[2]]]
  const expression = base.solution.slice(base.solution.indexOf('return ') + 7, base.solution.lastIndexOf(';'))
  const helpers = `const process = input => { const value = ${expression}; return ${transform}; };`
  const solutionBody = difficulty === 'Easy' ? 'return process(input);' : difficulty === 'Medium' ? 'return input.map(process);' : `const canonical = ${canonical.toString()};
  const groups = new Map();
  for (const item of input) {
    const value = process(item), key = JSON.stringify(canonical(value));
    if (groups.has(key)) groups.get(key).count++;
    else groups.set(key, { value, count: 1 });
  }
  return [...groups.values()];`
  const batchInstruction = difficulty === 'Easy' ? '' : difficulty === 'Medium' ? ' Input is a batch of individual inputs. Return their transformed results in order; an empty batch returns [].' : ' Input is a batch of individual inputs. Group structurally equal transformed results into [{value, count}] in first-seen order. Object key order does not matter; array order matters. An empty batch returns [].'
  return {
    ...base, id: `${subjectId}-${difficulty.toLowerCase()}-${attempt}`, difficulty, attempt,
    title: `${base.title} · ${difficulty} challenge ${attempt}`,
    description: `${base.description} ${instruction}${batchInstruction}`,
    solution: `function solve(input) {\n  ${helpers}\n  ${solutionBody}\n}`,
    testCases: cases.map((input, i) => ({ name: `Case ${i + 1}`, input, expected: solve(structuredClone(input)) })),
  }
}

let lastAttempt = 0
export function nextCodingAttempt(storage) {
  const key = 'quizly-coding-attempt'
  let previous = 0
  try { previous = Number(storage?.getItem(key)) || 0 } catch { /* Storage may be disabled. */ }
  const attempt = Math.max(lastAttempt + 1, Number.isSafeInteger(previous) && previous >= 0 ? previous + 1 : 1)
  lastAttempt = attempt
  try { storage?.setItem(key, String(attempt)) } catch { /* Practice still works without storage. */ }
  return attempt
}
