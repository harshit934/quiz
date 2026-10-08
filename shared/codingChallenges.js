import { flattenSubjectCategories } from './subjectCatalog.js'

// Each case supplies one JSON input to solve(input) and compares the JSON output.
const tasks = {
  programming: ['Sum a list', 'Return the sum of all numbers. An empty list sums to zero.', 'input.reduce((sum, n) => sum + n, 0)', [[[2, 3], 5], [[], 0], [[-3, 3, 7], 7]]],
  javascript: ['Unique values', 'Return unique values in their original order.', '[...new Set(input)]', [[[1, 1, 2], [1, 2]], [[], []], [['a', 'b', 'a'], ['a', 'b']]]],
  python: ['List comprehension practice', 'Implement the equivalent of a Python list comprehension: return the squares of the even numbers.', 'input.filter(n => n % 2 === 0).map(n => n * n)', [[[1, 2, 3, 4], [4, 16]], [[], []], [[-2, 0, 5], [4, 0]]]],
  'node-js': ['Parse log lines', 'Return the messages from lines starting with "ERROR: ", without that prefix.', 'input.filter(line => line.startsWith("ERROR: ")).map(line => line.slice(7))', [[['INFO: ready', 'ERROR: failed'], ['failed']], [[], []], [['ERROR: one', 'ERROR: two'], ['one', 'two']]]],
  java: ['Group words by length', 'Build an object mapping each word length to the number of words with that length. This practices the same grouping used with Java maps.', 'input.reduce((counts, word) => { counts[word.length] = (counts[word.length] || 0) + 1; return counts }, {})', [[['cat', 'dog', 'hi'], { 2: 1, 3: 2 }], [[], {}], [['', 'a', 'b'], { 0: 1, 1: 2 }]]],
  'git-github': ['Find unmerged branches', 'Return the sorted names of branches whose merged field is false.', 'input.filter(branch => !branch.merged).map(branch => branch.name).sort()', [[[{ name: 'main', merged: true }, { name: 'feature', merged: false }], ['feature']], [[], []], [[{ name: 'z', merged: false }, { name: 'a', merged: false }], ['a', 'z']]]],
  'web-development': ['Build a query string', 'Sort an object’s keys and join encoded key=value pairs with &. Encode both keys and values using encodeURIComponent.', 'Object.keys(input).sort().map(key => encodeURIComponent(key) + "=" + encodeURIComponent(input[key])).join("&")', [[{ q: 'hello world', page: 2 }, 'page=2&q=hello%20world'], [{}, ''], [{ 'a&b': 'x=y' }, 'a%26b=x%3Dy']]],
  react: ['Update state immutably', 'Given {items, id}, return a new list with the matching item’s done flag toggled. Preserve other fields.', 'input.items.map(item => item.id === input.id ? { ...item, done: !item.done } : item)', [[{ items: [{ id: 1, done: false }], id: 1 }, [{ id: 1, done: true }]], [{ items: [], id: 1 }, []], [{ items: [{ id: 2, done: true }], id: 9 }, [{ id: 2, done: true }]]]],
  html: ['Escape text for HTML', 'Replace &, <, >, double quotes and single quotes with &amp;, &lt;, &gt;, &quot; and &#39; respectively.', 'input.replace(/[&<>"\x27]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "\x27": "&#39;" })[c])', [['<p>A&B</p>', '&lt;p&gt;A&amp;B&lt;/p&gt;'], ['', ''], ['"hello"', '&quot;hello&quot;']]],
  css: ['Calculate a border-box width', 'Given {content, padding, border}, return the total width: content plus left/right padding and borders.', 'input.content + 2 * input.padding + 2 * input.border', [[{ content: 100, padding: 10, border: 2 }, 124], [{ content: 0, padding: 0, border: 0 }, 0], [{ content: 50, padding: 5, border: 1 }, 62]]],
  'react-js': ['Filter a rendered list', 'Given {items, query}, return names containing query, ignoring case, in original order.', 'input.items.filter(name => name.toLowerCase().includes(input.query.toLowerCase()))', [[{ items: ['React', 'Java'], query: 'rea' }, ['React']], [{ items: ['A', 'B'], query: '' }, ['A', 'B']], [{ items: [], query: 'x' }, []]]],
  'ai-machine-learning': ['Predict with a linear model', 'Given {features, weights, bias}, return the dot product of features and weights plus bias. Arrays have equal length.', 'input.features.reduce((sum, value, i) => sum + value * input.weights[i], input.bias)', [[{ features: [2, 3], weights: [4, 5], bias: 1 }, 24], [{ features: [], weights: [], bias: 2 }, 2], [{ features: [-1, 0], weights: [2, 8], bias: 0 }, -2]]],
  'data-science': ['Calculate the mean', 'Return the arithmetic mean of a numeric list, or null for an empty list.', 'input.length ? input.reduce((sum, n) => sum + n, 0) / input.length : null', [[[2, 4, 6], 4], [[], null], [[-2, 2], 0]]],
  databases: ['Join users to orders', 'Given {users, orders}, return each order with a userName field. Match order.userId to user.id; use null for missing users.', 'input.orders.map(order => ({ ...order, userName: input.users.find(user => user.id === order.userId)?.name ?? null }))', [[{ users: [{ id: 1, name: 'Ada' }], orders: [{ id: 7, userId: 1 }] }, [{ id: 7, userId: 1, userName: 'Ada' }]], [{ users: [], orders: [{ id: 8, userId: 2 }] }, [{ id: 8, userId: 2, userName: null }]], [{ users: [], orders: [] }, []]]],
  mongodb: ['Filter documents', 'Given {documents, minAge}, return names of active documents whose age is at least minAge, in original order.', 'input.documents.filter(doc => doc.active && doc.age >= input.minAge).map(doc => doc.name)', [[{ documents: [{ name: 'Ada', age: 20, active: true }, { name: 'Bob', age: 30, active: false }], minAge: 18 }, ['Ada']], [{ documents: [], minAge: 0 }, []], [{ documents: [{ name: 'Eve', age: 18, active: true }], minAge: 18 }, ['Eve']]]],
  sql: ['Group sales by region', 'Given sales records {region, amount}, return an object containing the summed amount for each region. This models GROUP BY with SUM.', 'input.reduce((totals, row) => { totals[row.region] = (totals[row.region] || 0) + row.amount; return totals }, Object.create(null))', [[[{ region: 'East', amount: 3 }, { region: 'East', amount: 7 }], { East: 10 }], [[], {}], [[{ region: 'West', amount: -2 }, { region: 'East', amount: 4 }], { West: -2, East: 4 }]]],
  cybersecurity: ['Validate a password policy', 'Return true only when a string has at least 8 characters, an uppercase letter, a lowercase letter, and a digit. This is a policy exercise, not a password-strength estimator.', 'input.length >= 8 && /[A-Z]/.test(input) && /[a-z]/.test(input) && /[0-9]/.test(input)', [['Abcdef12', true], ['short1A', false], ['abcdefgh', false], ['ABCDEFG1', false]]],
  'cloud-computing': ['Plan autoscaling capacity', 'Given {requests, perInstance, maxInstances}, return the number of instances needed, rounding up, with a minimum of 1 and a cap of maxInstances. perInstance and maxInstances are positive.', 'Math.min(input.maxInstances, Math.max(1, Math.ceil(input.requests / input.perInstance)))', [[{ requests: 250, perInstance: 100, maxInstances: 10 }, 3], [{ requests: 0, perInstance: 100, maxInstances: 10 }, 1], [{ requests: 9999, perInstance: 100, maxInstances: 5 }, 5]]],
}

const baseChallenges = flattenSubjectCategories()
  .filter(subject => subject.rootSlug === 'technology' && subject.slug !== 'technology')
  .map(subject => {
    const [title, description, expression, cases] = tasks[subject.slug]
    return {
      id: subject.slug, subject: subject.name, title, description,
      language: 'JavaScript',
      starter: 'function solve(input) {\n  // Write your solution here\n  return null;\n}',
      solution: `function solve(input) {\n  return ${expression};\n}`,
      testCases: cases.map(([input, expected], i) => ({ name: `Case ${i + 1}`, input, expected })),
    }
  })

export const codingChallenges = baseChallenges.flatMap(base => {
  const expression = tasks[base.id][2]
  const inputs = base.testCases.map(test => test.input)
  const outputs = base.testCases.map(test => test.expected)
  const countOutputs = values => {
    const counts = new Map()
    for (const value of values) {
      const key = JSON.stringify(value)
      if (counts.has(key)) counts.get(key).count++
      else counts.set(key, { value, count: 1 })
    }
    return [...counts.values()]
  }
  return [
    { ...base, id: `${base.id}-easy`, subjectId: base.id, difficulty: 'Easy' },
    {
      ...base, id: `${base.id}-medium`, subjectId: base.id, difficulty: 'Medium',
      title: `${base.title}: batch processing`,
      description: `${base.description} Now solve a batch: input is an array of individual inputs. Return the corresponding results in order. An empty batch returns [].`,
      solution: `function solve(inputs) {\n  const process = input => ${expression};\n  return inputs.map(process);\n}`,
      testCases: [
        { name: 'Mixed batch', input: inputs, expected: outputs },
        { name: 'Empty batch', input: [], expected: [] },
        { name: 'Repeated inputs', input: [inputs[0], inputs[0]], expected: [outputs[0], outputs[0]] },
      ],
    },
    {
      ...base, id: `${base.id}-hard`, subjectId: base.id, difficulty: 'Hard',
      title: `${base.title}: grouped results`,
      description: `${base.description} Input is a batch of individual inputs. Compute their results, group equal results, and return [{value, count}] in first-seen order. Equality compares JSON values structurally (object key order does not matter). Keep arrays in their original order. An empty batch returns [].`,
      solution: `function solve(inputs) {\n  const process = input => ${expression};\n  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;\n  const groups = new Map();\n  for (const input of inputs) {\n    const value = process(input);\n    const key = JSON.stringify(canonical(value));\n    if (groups.has(key)) groups.get(key).count++;\n    else groups.set(key, { value, count: 1 });\n  }\n  return [...groups.values()];\n}`,
      testCases: [
        { name: 'Mixed results', input: inputs, expected: countOutputs(outputs) },
        { name: 'Empty batch', input: [], expected: [] },
        { name: 'Duplicate results', input: [inputs[0], inputs[1], inputs[0]], expected: countOutputs([outputs[0], outputs[1], outputs[0]]) },
        { name: 'First-seen order', input: [inputs[2], inputs[0], inputs[2]], expected: countOutputs([outputs[2], outputs[0], outputs[2]]) },
      ],
    },
  ]
})
