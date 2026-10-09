export function updatePracticeMistakes(items, challenge, code, results) {
  const previous = items.find(item => item.challenge.id === challenge.id)
  const remaining = items.filter(item => item.challenge.id !== challenge.id)
  if (results.length && results.every(item => item.passed)) {
    return previous ? [{ ...previous, resolved: true, updatedAt: Date.now() }, ...remaining].slice(0, 50) : items
  }
  return [{ challenge: { ...challenge, draft: undefined, deadline: undefined }, code, results, resolved: false, updatedAt: Date.now() }, ...remaining].slice(0, 50)
}
