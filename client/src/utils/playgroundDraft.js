export function readPlaygroundDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key))
    return draft && typeof draft.code === 'string' && typeof draft.input === 'string' ? draft : null
  } catch { return null }
}
export function savePlaygroundDraft(storage, key, draft) {
  try { storage.setItem(key, JSON.stringify({ code: draft.code, input: draft.input })); return true }
  catch { return false }
}
