const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
self.onmessage = async ({ data }) => {
  try {
    const { runtime, code, testCases } = data
    let execute
    if (runtime === 'python') {
      const { loadPyodide } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs')
      const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/' })
      self.postMessage({ ready: true })
      py.globals.set('learner_code', code)
      py.globals.set('fixtures_json', JSON.stringify(testCases))
      const output = await py.runPythonAsync(`import json
namespace = {}
exec(learner_code, namespace)
if not callable(namespace.get('solve')):
    raise ValueError('Define def solve(input):')
results = []
for case in json.loads(fixtures_json):
    try:
        actual = namespace['solve'](case['input'])
        results.append({'name': case['name'], 'actual': actual, 'passed': actual == case['expected']})
    except Exception as error:
        results.append({'name': case['name'], 'passed': False, 'error': str(error)})
json.dumps(results, allow_nan=False)`)
      self.postMessage({ results: JSON.parse(output) }); return
    }
    if (runtime === 'sql') {
      const [{ default: init }, { default: wasm }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')])
      const SQL = await init({ locateFile: () => wasm })
      execute = input => {
        const db = new SQL.Database()
        try {
          db.run('CREATE TABLE sales (region TEXT, amount INTEGER)')
          for (const row of input.sales) db.run('INSERT INTO sales VALUES (?, ?)', [row.region, row.amount])
          const result = db.exec(code)
          if (result.length > 1) throw new Error('Return one result set.')
          return result.length ? result[0].values.map(row => Object.fromEntries(result[0].columns.map((key, i) => [key, row[i]]))) : []
        } finally { db.close() }
      }
    }
    if (runtime === 'mongodb') {
      const { aggregate } = await import('mingo')
      const pipeline = JSON.parse(code)
      if (!Array.isArray(pipeline)) throw new Error('Enter an aggregation pipeline as a JSON array.')
      execute = input => aggregate(input, pipeline, { scriptEnabled: false })
    }
    if (runtime === 'jsx') {
      const [babel, { default: React }, { renderToStaticMarkup }] = await Promise.all([import('@babel/standalone'), import('react'), import('react-dom/server')])
      self.postMessage({ ready: true })
      const compiled = babel.transform(code, { presets: [['react', { runtime: 'classic' }]] }).code
      const App = new Function('React', `${compiled}; return App;`)(React)
      self.postMessage({ html: renderToStaticMarkup(React.createElement(App)) }); return
    }
    self.postMessage({ ready: true })
    const results = testCases.map(test => {
      try { const actual = execute(structuredClone(test.input)); return { name: test.name, actual, passed: same(actual, test.expected) } }
      catch (error) { return { name: test.name, passed: false, error: error.message } }
    })
    self.postMessage({ results })
  } catch (error) { self.postMessage({ error: error.message }) }
}
