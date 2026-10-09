import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

test('Python playground prints scripts and keeps optional solve return values', t => {
  if (spawnSync('python', ['--version']).error?.code === 'ENOENT') {
    t.skip('Python is unavailable for the native Python source check')
    return
  }
  const source = readFileSync(new URL('./native.worker.js', import.meta.url), 'utf8')
  const program = source.match(/if \(data\.playground\) \{\s*const output = await py\.runPythonAsync\(`([\s\S]*?)`\)/)[1]
  const run = code => {
    const result = spawnSync('python', ['-c', `import os\nlearner_code = os.environ['QUIZLY_TEST_CODE']\nfixtures_json = '[{"input": 3}]'\n${program}\nprint(json.dumps(results))`], { encoding: 'utf8', env: { ...process.env, QUIZLY_TEST_CODE: code } })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }
  assert.deepEqual(run('print("Hello Python")\nfor n in range(3):\n    print(n)'), [{ name: 'Printed output', actual: 'Hello Python\n0\n1\n2\n' }])
  assert.deepEqual(run('def solve(input):\n    print("running")\n    return input * 2'), [{ name: 'Printed output', actual: 'running\n' }, { name: 'Return value', actual: 6 }])
  assert.match(run('x = 1')[0].actual, /without output/)
})
