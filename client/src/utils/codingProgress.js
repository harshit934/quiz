export function codingScore(passed, total, difficulty) {
  const maximum = { Easy: 40, Medium: 60, Hard: 100 }[difficulty] || 0
  return total > 0 ? Math.round(Math.max(0, Math.min(passed, total)) / total * maximum) : 0
}
export function readCodingProgress(storage, key) {
  try {
    const data = JSON.parse(storage.getItem(key) || '{}')
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch { return {} }
}
export function writeCodingProgress(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
export function readCodingDraft(storage, key) {
  try {
    const data = JSON.parse(storage.getItem(`${key}-saved-code`) || 'null')
    return typeof data?.code === 'string' && typeof data?.challenge?.subjectId === 'string' && Array.isArray(data?.challenge?.testCases) && data.challenge.testCases.length > 0 ? data : null
  } catch { return null }
}
