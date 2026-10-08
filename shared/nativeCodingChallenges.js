export const subjectLanguages = {
  programming: { language: 'JavaScript', runtime: 'javascript', badge: 'JS' },
  javascript: { language: 'JavaScript', runtime: 'javascript', badge: 'JS' },
  python: { language: 'Python', runtime: 'python', badge: 'PY' },
  'node-js': { language: 'Node.js', runtime: 'nodejs', badge: 'NODE' },
  java: { language: 'Java', runtime: 'java', badge: 'JAVA' },
  'git-github': { language: 'Bash / Git', runtime: 'bash', badge: 'GIT' },
  'web-development': { language: 'HTML', runtime: 'html', badge: 'HTML' },
  react: { language: 'React JSX', runtime: 'jsx', badge: 'JSX' },
  html: { language: 'HTML', runtime: 'html', badge: 'HTML' },
  css: { language: 'CSS', runtime: 'css', badge: 'CSS' },
  'react-js': { language: 'React JSX', runtime: 'jsx', badge: 'JSX' },
  'ai-machine-learning': { language: 'Python', runtime: 'python', badge: 'PY' },
  'data-science': { language: 'Python', runtime: 'python', badge: 'PY' },
  databases: { language: 'SQL', runtime: 'sql', badge: 'SQL' },
  mongodb: { language: 'MongoDB query (JSON)', runtime: 'mongodb', badge: 'MDB' },
  sql: { language: 'SQL', runtime: 'sql', badge: 'SQL' },
  cybersecurity: { language: 'Python', runtime: 'python', badge: 'PY' },
  'cloud-computing': { language: 'Bash', runtime: 'bash', badge: 'SH' },
}

const pythonProcesses = {
  python: 'return [n * n for n in input if n % 2 == 0]',
  'data-science': 'return sum(input) / len(input) if input else None',
  'ai-machine-learning': 'return sum(x * w for x, w in zip(input["features"], input["weights"])) + input["bias"]',
  cybersecurity: 'return len(input) >= 8 and any("A" <= c <= "Z" for c in input) and any("a" <= c <= "z" for c in input) and any("0" <= c <= "9" for c in input)',
}

export function nativeChallenge(challenge) {
  const meta = subjectLanguages[challenge.subjectId]
  const next = { ...challenge, ...meta, instructions: 'Define solve(input) and return the result.' }
  const a = challenge.attempt, p = a + 1, level = challenge.difficulty
  if (meta.runtime === 'python') {
    let transform = `return None if value is None else value * ${p} + ${a}`
    if (challenge.subjectId === 'python') transform = `return value[${p} % len(value):] + value[:${p} % len(value)] if value else []`
    if (challenge.subjectId === 'cybersecurity') transform = `return ${p} if value else ${-p}`
    let body = 'return process(input)'
    if (level === 'Medium') body = 'return [process(item) for item in input]'
    if (level === 'Hard') body = 'groups = {}\n    for item in input:\n        value = process(item)\n        key = json.dumps(value, sort_keys=True)\n        if key in groups:\n            groups[key]["count"] += 1\n        else:\n            groups[key] = {"value": value, "count": 1}\n    return list(groups.values())'
    next.starter = 'def solve(input):\n    # Write your solution here\n    return None'
    next.solution = `import json\n\ndef process(input):\n    ${pythonProcesses[challenge.subjectId].replace('return ', 'value = ')}\n    ${transform}\n\ndef solve(input):\n    ${body}`
    next.description = next.description.replace('Implement the equivalent of a Python list comprehension:', 'Use a Python list comprehension to')
    next.instructions = 'Define def solve(input): and return the expected Python value. Imports from the Python standard library are supported.'
  }
  if (meta.runtime === 'java') {
    const operation = level === 'Easy' ? 'sum' : level === 'Medium' ? 'sum of squares' : 'sum of distinct values'
    const compute = values => level === 'Easy' ? values.reduce((s, n) => s + n, 0) : level === 'Medium' ? values.reduce((s, n) => s + n * n, 0) : [...new Set(values)].reduce((s, n) => s + n, 0)
    next.title = `${operation[0].toUpperCase() + operation.slice(1)} · ${level} challenge ${a}`
    next.description = `Read space-separated integers from standard input and print their ${operation}. Empty input must print 0. Use Java; the class must be named Main.`
    next.starter = 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Read integers and print the answer\n        System.out.println(0);\n    }\n}'
    next.solution = `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner s = new Scanner(System.in);\n        long total = 0;\n        Set<Long> seen = new HashSet<>();\n        while (s.hasNextLong()) {\n            long n = s.nextLong();\n            ${level === 'Easy' ? 'total += n;' : level === 'Medium' ? 'total += n * n;' : 'if (seen.add(n)) total += n;'}\n        }\n        System.out.println(total);\n    }\n}`
    next.testCases = [[a, p, a], [], [-a, 0, p]].map((values, i) => ({ name: `Case ${i + 1}`, input: values, stdin: values.join(' '), expected: compute(values) }))
    next.instructions = 'Use public class Main, read integers from System.in, and print one numeric answer. Requires the configured compiler service.'
  }
  if (meta.runtime === 'nodejs') next.instructions = 'Define solve(input) in Node.js. The runner reads each JSON input from stdin and prints the returned value. Node built-in modules are available through require(). Requires the configured compiler service.'
  if (meta.runtime === 'bash') {
    next.starter = '#!/usr/bin/env bash\n# Read standard input and print the answer\n'
    if (challenge.subjectId === 'git-github') {
      next.title = `Git branch validation · ${level} challenge ${a}`
      next.description = 'Read one proposed branch name from standard input. Use git check-ref-format --branch to print valid for a valid branch name and invalid otherwise. Do not print other output.'
      next.solution = '#!/usr/bin/env bash\nIFS= read -r branch\nif git check-ref-format --branch "$branch" >/dev/null 2>&1; then\n  echo valid\nelse\n  echo invalid\nfi'
      const names = [`feature/attempt-${a}`, `bad branch ${a}`, 'bad..name']
      if (level !== 'Easy') names.push('-invalid', 'release/v1')
      if (level === 'Hard') names.push('bad@{name', 'bad.lock', 'end/')
      next.testCases = names.map((name, i) => ({ name: `Case ${i + 1}`, input: name, stdin: name + '\n', expected: name.startsWith('feature/') || name === 'release/v1' ? 'valid' : 'invalid' }))
    } else {
      next.title = `Autoscaling shell script · ${level} challenge ${a}`
      next.description = 'Read requests, capacity per instance, and maximum instances as three space-separated integers. Print ceil(requests / capacity), with a minimum of 1 and a cap at maximum. Capacity and maximum are positive.'
      next.solution = '#!/usr/bin/env bash\nread -r requests capacity maximum\ncount=$(( (requests + capacity - 1) / capacity ))\nif (( count < 1 )); then count=1; fi\nif (( count > maximum )); then count=$maximum; fi\nprintf "%s\\n" "$count"'
      next.testCases = [[100 + a, 10 + a, 20], [0, 10, 5], [1000 + a, 10, 3]].map((values, i) => ({ name: `Case ${i + 1}`, input: values, stdin: values.join(' ') + '\n', expected: Math.min(values[2], Math.max(1, Math.ceil(values[0] / values[1]))) }))
      if (level === 'Medium') next.testCases.push({ name: 'Exact capacity', input: [p * 2, p, 10], stdin: `${p * 2} ${p} 10\n`, expected: 2 })
      if (level === 'Hard') next.testCases.push({ name: 'Large capacity', input: [p, p * 10, 2], stdin: `${p} ${p * 10} 2\n`, expected: 1 })
    }
    next.instructions = 'Write a Bash script. Read stdin and print the required result. Git exercises require Git installed in the isolated compiler environment.'
  }
  if (meta.runtime === 'sql') {
    const sales = [{ region: 'East', amount: a }, { region: 'West', amount: p }, { region: 'East', amount: p }]
    next.title = `Sales query · ${level} challenge ${a}`
    next.description = `Query the sales table (region TEXT, amount INTEGER). ${level === 'Easy' ? `Select region and amount for rows whose amount is at least ${p}, ordered by region then amount.` : `Return region and SUM(amount) AS total, grouped by region${level === 'Hard' ? ` and keep only groups with a total greater than ${p}` : ''}, ordered by region.`}`
    next.solution = level === 'Easy' ? `SELECT region, amount FROM sales WHERE amount >= ${p} ORDER BY region, amount;` : `SELECT region, SUM(amount) AS total FROM sales GROUP BY region ${level === 'Hard' ? `HAVING SUM(amount) > ${p} ` : ''}ORDER BY region;`
    next.starter = '-- Write your SQLite query here\nSELECT * FROM sales;'
    const expected = rows => level === 'Easy' ? rows.filter(row => row.amount >= p).sort((x, y) => x.region.localeCompare(y.region) || x.amount - y.amount) : Object.entries(rows.reduce((groups, row) => ({ ...groups, [row.region]: (groups[row.region] || 0) + row.amount }), {})).filter(([, total]) => level !== 'Hard' || total > p).sort(([x], [y]) => x.localeCompare(y)).map(([region, total]) => ({ region, total }))
    next.testCases = [sales, [], [{ region: 'North', amount: p * 2 }, { region: 'South', amount: 0 }]].map((rows, i) => ({ name: `Dataset ${i + 1}`, input: { sales: rows }, expected: expected(rows) }))
    next.instructions = 'Write one SQLite SELECT query. Each test creates a fresh sales table and compares the rows and column names you return.'
  }
  if (meta.runtime === 'mongodb') {
    const documents = [{ name: 'Ada', age: p + 18, active: true }, { name: 'Bob', age: a + 30, active: false }, { name: 'Eve', age: 17, active: true }]
    next.title = `MongoDB document query · ${level} challenge ${a}`
    const threshold = a + 18
    const pipeline = [{ $match: { active: true, age: { $gte: threshold } } }, { $project: { _id: 0, name: 1, age: 1 } }, { $sort: { name: 1 } }]
    if (level === 'Hard') pipeline.splice(2, 0, { $addFields: { yearsAboveMinimum: { $subtract: ['$age', threshold] } } })
    next.description = `Write a MongoDB aggregation pipeline as a JSON array. Select active documents whose age is at least ${threshold}, project name and age (exclude _id)${level === 'Hard' ? `, add yearsAboveMinimum equal to age minus ${threshold}` : ''}, and sort by name. Queries run against in-memory sample documents.`
    next.starter = '[\n  { "$match": {} }\n]'
    next.solution = JSON.stringify(pipeline, null, 2)
    next.testCases = [documents, [], [{ name: 'Zoe', age: threshold, active: true }, { name: 'Amy', age: threshold + 1, active: true }]].map((rows, i) => ({ name: `Collection ${i + 1}`, input: rows, expected: rows.filter(row => row.active && row.age >= threshold).sort((x, y) => x.name.localeCompare(y.name)).map(({ name, age }) => ({ name, age, ...(level === 'Hard' ? { yearsAboveMinimum: age - threshold } : {}) })) }))
    next.instructions = 'Enter a JSON array of MongoDB aggregation stages. This uses an in-memory query engine, not a connection to your production database.'
  }
  if (meta.runtime === 'html' || meta.runtime === 'css' || meta.runtime === 'jsx') return webChallenge(next)
  return next
}

function webChallenge(next) {
  const a = next.attempt, level = next.difficulty
  const title = `Subscribe ${a}`, width = 250 + a % 100, gap = 8 + a % 20
  next.testCases = []
  const check = (name, assertion) => next.testCases.push({ name, input: null, expected: true, assertion })
  if (next.runtime === 'css') {
    next.title = `Style a subscription card · ${level} challenge ${a}`
    next.description = `Style .card with a width of ${width}px and padding of ${gap}px, using border-box sizing. Set the h1 color to rgb(70, 40, 180).${level !== 'Easy' ? ' Use display: flex and flex-direction: column on .card.' : ''}${level === 'Hard' ? ` Set a gap of ${gap}px on .card.` : ''}`
    next.scaffold = '<main class="card"><h1>Subscribe</h1><label>Email <input type="email"></label><button>Subscribe</button></main>'
    next.starter = '.card {\n  /* Write your styles here */\n}\n'
    next.solution = `.card { width: ${width}px; padding: ${gap}px; box-sizing: border-box;${level !== 'Easy' ? ' display: flex; flex-direction: column;' : ''}${level === 'Hard' ? ` gap: ${gap}px;` : ''} }\nh1 { color: rgb(70, 40, 180); }`
    check('Card width', { selector: '.card', property: 'width', value: `${width}px` })
    check('Card padding', { selector: '.card', property: 'padding-top', value: `${gap}px` })
    check('Border-box sizing', { selector: '.card', property: 'box-sizing', value: 'border-box' })
    check('Heading color', { selector: 'h1', property: 'color', value: 'rgb(70, 40, 180)' })
    if (level !== 'Easy') { check('Flex layout', { selector: '.card', property: 'display', value: 'flex' }); check('Column direction', { selector: '.card', property: 'flex-direction', value: 'column' }) }
    if (level === 'Hard') check('Spacing between controls', { selector: '.card', property: 'gap', value: `${gap}px` })
    next.instructions = 'Write CSS for the provided subscription-card HTML. Run tests to render your styles and check computed CSS values.'
  } else {
    const html = `<main><h1>${title}</h1><form><label for="email">Email</label><input id="email" type="email" required><button type="submit">Subscribe</button>${level !== 'Easy' ? '<label for="name">Name</label><input id="name" required>' : ''}${level === 'Hard' ? '<p role="status" aria-live="polite">Ready to subscribe</p>' : ''}</form></main>`
    next.title = `Build a subscription form · ${level} challenge ${a}`
    next.description = `Build a main element containing an h1 with the exact text "${title}" and a form. Include a label for="email", a required input id="email" type="email", and a submit button.${level !== 'Easy' ? ' Also include a label for="name" and a required input id="name".' : ''}${level === 'Hard' ? ' Add a status message with role="status", aria-live="polite", and text "Ready to subscribe".' : ''}`
    next.starter = next.runtime === 'jsx' ? 'function App() {\n  return <main>{/* Write your component here */}</main>;\n}' : '<!DOCTYPE html>\n<html lang="en">\n<head><title>Subscription form</title></head>\n<body>\n  <!-- Build your form here -->\n</body>\n</html>'
    next.solution = next.runtime === 'jsx' ? `function App() {\n  return (${html.replaceAll('for=', 'htmlFor=') .replaceAll('<input id="email" type="email" required>', '<input id="email" type="email" required />').replaceAll('<input id="name" required>', '<input id="name" required />')});\n}` : html
    check('Main content', { selector: 'main', count: 1 })
    check('Heading text', { selector: 'h1', text: title })
    check('Subscription form', { selector: 'form', count: 1 })
    check('Email label', { selector: 'label[for="email"]', count: 1 })
    check('Required email control', { selector: 'input#email[type="email"][required]', count: 1 })
    check('Submit button', { selector: 'button[type="submit"]', count: 1 })
    if (level !== 'Easy') { check('Name label', { selector: 'label[for="name"]', count: 1 }); check('Required name', { selector: 'input#name[required]', count: 1 }) }
    if (level === 'Hard') check('Accessible status', { selector: '[role="status"][aria-live="polite"]', text: 'Ready to subscribe' })
    next.instructions = next.runtime === 'jsx' ? 'Write a React function component named App using JSX. The runner renders its initial HTML and tests the rendered markup. Imports are not needed; React is provided.' : 'Write HTML markup. Scripts are disabled in previews; tests inspect the rendered elements and attributes.'
  }
  return next
}

