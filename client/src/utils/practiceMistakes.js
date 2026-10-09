export function readPracticeMistakes(storage, key) {
  try {
    const items = JSON.parse(storage.getItem(`${key}-mistakes`) || '[]')
    return Array.isArray(items) ? items.filter(item => typeof item?.challenge?.id === 'string' && typeof item.code === 'string' && Array.isArray(item.results)) : []
  } catch { return [] }
}

export { updatePracticeMistakes } from '../../../shared/practiceMistakes.js'

export function writePracticeMistakes(storage, key, items) {
  try { storage.setItem(`${key}-mistakes`, JSON.stringify(items)); return true } catch { return false }
}
