import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import initSqlJs from 'sql.js'
import { aggregate } from 'mingo'
import { transform } from '@babel/standalone'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SqlResultTable from '../SqlResultTable.js'
import { executeSql } from './sqlResult.js'
import { codingChallenges } from '../../../shared/codingChallenges.js'
import { generateCodingChallenge } from '../../../shared/generateCodingChallenge.js'
import { subjectLanguages } from '../../../shared/nativeCodingChallenges.js'

const all = codingChallenges.flatMap(base => [1, 2, 5].map(attempt => generateCodingChallenge(base.subjectId, base.difficulty, attempt)))
test('all subjects and difficulty levels use their mapped native language', () => {
  for (const challenge of all) {
    assert.equal(challenge.runtime, subjectLanguages[challenge.subjectId].runtime)
    assert.ok(challenge.starter && challenge.solution && challenge.instructions)
    assert.ok(challenge.testCases.length >= 3)
  }
  assert.equal(subjectLanguages.python.language, 'Python')
  assert.equal(subjectLanguages.html.language, 'HTML')
})
test('Python reference solutions pass every dataset at every level', () => {
  const cases = all.filter(challenge => challenge.runtime === 'python')
  const result = spawnSync('python', ['-c', `import sys,json
for challenge in json.load(sys.stdin):
    namespace = {}
    exec(challenge['solution'], namespace)
    for case in challenge['testCases']:
        actual = namespace['solve'](case['input'])
        assert actual == case['expected'], (challenge['id'], actual, case['expected'])
print('passed')`], { input: JSON.stringify(cases), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /passed/)
})
test('SQLite and MongoDB native references pass every dataset', async () => {
  const SQL = await initSqlJs()
  for (const challenge of all.filter(c => ['sql', 'mongodb'].includes(c.runtime))) {
    for (const fixture of challenge.testCases) {
      let actual
      if (challenge.runtime === 'mongodb') actual = aggregate(structuredClone(fixture.input), JSON.parse(challenge.solution), { scriptEnabled: false })
      else {
        const db = new SQL.Database()
        db.run('CREATE TABLE sales (region TEXT, amount INTEGER)')
        for (const row of fixture.input.sales) db.run('INSERT INTO sales VALUES (?, ?)', [row.region, row.amount])
        const result = db.exec(challenge.solution)
        actual = result.length ? result[0].values.map(row => Object.fromEntries(result[0].columns.map((key, i) => [key, row[i]]))) : []
        db.close()
      }
      assert.deepEqual(actual, fixture.expected, challenge.id)
    }
  }
})
test('SQL playground output preserves headers, rows, empty results, and write statements', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  try {
    assert.deepEqual(executeSql(db, 'CREATE TABLE people (name TEXT, active INTEGER)', true), {
      type: 'success', message: 'Query executed successfully.',
    })
    executeSql(db, "INSERT INTO people VALUES ('Ada', 1), ('Grace', 0)", true)
    const selected = executeSql(db, 'SELECT name AS person, active FROM people ORDER BY name', true)
    assert.deepEqual(selected, { type: 'table', columns: ['person', 'active'], rows: [['Ada', 1], ['Grace', 0]] })
    assert.deepEqual(executeSql(db, 'SELECT name AS person, active FROM people ORDER BY name', false), [{ person: 'Ada', active: 1 }, { person: 'Grace', active: 0 }])
    const table = renderToStaticMarkup(React.createElement(SqlResultTable, selected))
    assert.match(table, /<th scope="col">person<\/th>/)
    assert.match(table, /<td>Ada<\/td>/)
    assert.match(table, /<td>Grace<\/td>/)
    assert.equal((table.match(/<tr>/g) || []).length, 3)

    const empty = executeSql(db, 'SELECT name, active FROM people WHERE active = 2', true)
    assert.deepEqual(empty, { type: 'table', columns: ['name', 'active'], rows: [] })
    assert.match(renderToStaticMarkup(React.createElement(SqlResultTable, empty)), /No rows returned\./)
    const emptyAfterSetup = executeSql(db, 'CREATE TABLE empty_rows (id INTEGER); SELECT id FROM empty_rows', true)
    assert.deepEqual(emptyAfterSetup, { type: 'table', columns: ['id'], rows: [] })
    for (const query of [
      "INSERT INTO people VALUES ('Linus', 1)",
      'UPDATE people SET active = 1 WHERE name = \'Grace\'',
      "DELETE FROM people WHERE name = 'Linus'",
    ]) {
      assert.deepEqual(executeSql(db, query, true), { type: 'success', message: 'Query executed successfully.' })
    }
    assert.deepEqual(executeSql(db, 'SELECT name, active FROM people ORDER BY name', true), {
      type: 'table', columns: ['name', 'active'], rows: [['Ada', 1], ['Grace', 1]],
    })
    assert.throws(() => executeSql(db, 'SELECT name FROM people; SELECT active FROM people', true), /one result set/)
    assert.throws(() => executeSql(db, 'SELECT missing FROM people', true))
  } finally {
    db.close()
  }
})
test('React references compile JSX and render the required native markup', () => {
  for (const challenge of all.filter(c => c.runtime === 'jsx')) {
    const compiled = transform(challenge.solution, { presets: [['react', { runtime: 'classic' }]] }).code
    const App = new Function('React', `${compiled}; return App;`)(React)
    const html = renderToStaticMarkup(React.createElement(App))
    assert.match(html, /<form>/)
    assert.ok(html.includes(`Subscribe ${challenge.attempt}`))
    assert.match(html, /type="email"/)
    if (challenge.difficulty === 'Hard') assert.match(html, /aria-live="polite"/)
  }
})
