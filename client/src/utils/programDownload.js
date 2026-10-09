export const programExtensions = {
  javascript: 'js', python: 'py', html: 'html', css: 'css', react: 'jsx', sql: 'sql', mongodb: 'json',
  c: 'c', cpp: 'cpp', java: 'java', 'node-js': 'js', 'cloud-computing': 'sh', csharp: 'cs', typescript: 'ts',
  go: 'go', rust: 'rs', kotlin: 'kt', swift: 'swift', php: 'php', ruby: 'rb', r: 'r', dart: 'dart', scala: 'scala',
  perl: 'pl', lua: 'lua', haskell: 'hs', elixir: 'exs', erlang: 'erl', clojure: 'clj', groovy: 'groovy',
  fortran: 'f90', pascal: 'pas', ocaml: 'ml', octave: 'm', d: 'd', 'common-lisp': 'lisp', prolog: 'pl',
  fsharp: 'fs', vbnet: 'vb', basic: 'bas', cobol: 'cob', 'objective-c': 'm', assembly: 'asm',
}

export function programFilename(name, language) {
  const extension = programExtensions[language] || 'txt'
  let base = (name || 'program').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || 'program'
  if (base.toLowerCase().endsWith(`.${extension}`)) base = base.slice(0, -(extension.length + 1)) || 'program'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `program-${base}`
  return `${base.slice(0, 100)}.${extension}`
}

export function downloadProgram(program) {
  const url = URL.createObjectURL(new Blob([program.code], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = programFilename(program.name, program.language)
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
