export function readPlaygroundDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key))
    return draft && typeof draft.code === 'string' && typeof draft.input === 'string' ? draft : null
  } catch { return null }
}
export function savePlaygroundDraft(storage, key, draft) {
  try {
    storage.setItem(key, JSON.stringify({ code: draft.code, input: draft.input }))
    const saved = readPlaygroundDraft(storage, key)
    return saved?.code === draft.code && saved?.input === draft.input
  }
  catch { return false }
}

export function readPlaygroundLanguage(storage, account, languages) {
  try {
    const saved = storage.getItem(`quizly-playground-${account}-language`)
    return languages.includes(saved) ? saved : 'javascript'
  } catch { return 'javascript' }
}
