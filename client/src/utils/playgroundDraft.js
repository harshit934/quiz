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

export function readNamedPrograms(storage, account) {
  try {
    const programs = JSON.parse(storage.getItem(`quizly-playground-${account}-programs`))
    return Array.isArray(programs) ? programs.filter(item => item && ['id', 'name', 'language', 'code', 'input'].every(key => typeof item[key] === 'string')) : []
  } catch { return [] }
}

export function saveNamedProgram(storage, account, program) {
  const name = program.name.trim()
  if (!name || name.length > 80) throw new Error('Enter a program name between 1 and 80 characters.')
  const programs = readNamedPrograms(storage, account)
  const existing = programs.find(item => item.language === program.language && item.name.toLowerCase() === name.toLowerCase())
  if (existing && existing.id !== program.id) throw new Error('That name is already used for this language. Choose another name or open the existing program.')
  const saved = { ...program, name, id: program.id || crypto.randomUUID(), updatedAt: new Date().toISOString() }
  const next = [saved, ...programs.filter(item => item.id !== saved.id)]
  storage.setItem(`quizly-playground-${account}-programs`, JSON.stringify(next))
  const restored = readNamedPrograms(storage, account).find(item => item.id === saved.id)
  if (!restored || restored.code !== saved.code || restored.input !== saved.input) throw new Error('Unable to save. Copy your code to keep it.')
  return saved
}

export function listSavedPrograms(storage, account, languages) {
  const programs = readNamedPrograms(storage, account)
  for (const [language, label] of languages) {
    const runtime = { react: 'jsx', 'node-js': 'nodejs', 'cloud-computing': 'bash' }[language] || language
    const draft = readPlaygroundDraft(storage, `quizly-playground-${account}-${runtime}`)
    if (draft && !programs.some(item => item.language === language && item.code === draft.code && item.input === draft.input)) {
      programs.push({ id: `legacy-${runtime}`, name: `Saved ${label} draft`, language, code: draft.code, input: draft.input })
    }
  }
  return programs
}
