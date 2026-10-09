export function readPracticeMistakes(storage, key) {
  try {
    const items = JSON.parse(storage.getItem(`${key}-mistakes`) || '[]')
    return Array.isArray(items) ? items.filter(item => typeof item?.challenge?.id === 'string' && typeof item.code === 'string' && Array.isArray(item.results)) : []
  } catch { return [] }
}

export function updatePracticeMistakes(items, challenge, code, results) {
  const previous = items.find(item => item.challenge.id === challenge.id)
  const remaining = items.filter(item => item.challenge.id !== challenge.id)
  if (results.length && results.every(item => item.passed)) {
    return previous ? [{ ...previous, resolved: true, updatedAt: Date.now() }, ...remaining].slice(0, 50) : items
  }
  return [{ challenge: { ...challenge, draft: undefined, deadline: undefined }, code, results, resolved: false, updatedAt: Date.now() }, ...remaining].slice(0, 50)
}

export function writePracticeMistakes(storage, key, items) {
  try { storage.setItem(`${key}-mistakes`, JSON.stringify(items)); return true } catch { return false }
}
