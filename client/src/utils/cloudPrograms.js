import { request } from '../services/api.js'

export const loadCloudPrograms = async () => (await request('/coding/programs')).programs
export const putCloudProgram = async program => (await request(`/coding/programs/${encodeURIComponent(program.id)}`, {
  method: 'PUT', body: JSON.stringify({ name: program.name, language: program.language, code: program.code, input: program.input, revision: program.revision || 0 }),
})).program
export const removeCloudProgram = program => request(`/coding/programs/${encodeURIComponent(program.id)}`, { method: 'DELETE', body: JSON.stringify({ revision: program.revision }) })

export function mergeProgramLibrary(local, cloud) {
  const merged = cloud.map(program => {
    const pending = local.find(item => item.id === program.id && item.pending)
    return pending ? { ...pending, cloud: true } : { ...program, cloud: true }
  })
  return [...merged, ...local.filter(item => !cloud.some(program => program.id === item.id)).map(program => ({ ...program, cloud: false }))]
}
