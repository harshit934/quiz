import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import initSqlJs from 'sql.js'
import { aggregate } from 'mingo'
import { transform } from '@babel/standalone'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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
