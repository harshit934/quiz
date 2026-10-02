import { flattenSubjectCategories, flattenSubjectQuizzes } from '../../../shared/subjectCatalog.js'

const legacyDemoCategories = [
  { _id: 'cat-js', name: 'JavaScript', slug: 'javascript', icon: 'code-2', color: '#f1c75b', quizCount: 1 },
  { _id: 'cat-react', name: 'React', slug: 'react', icon: 'atom', color: '#56cfe1', quizCount: 1 },
  { _id: 'cat-html', name: 'HTML', slug: 'html', icon: 'panels-top-left', color: '#ff835c', quizCount: 1 },
  { _id: 'cat-css', name: 'CSS', slug: 'css', icon: 'paintbrush', color: '#8585ff', quizCount: 1 },
  { _id: 'cat-python', name: 'Python', slug: 'python', icon: 'terminal', color: '#75c7a4', quizCount: 1 },
  { _id: 'cat-data', name: 'Data Science', slug: 'data-science', icon: 'chart-no-axes-combined', color: '#49c7ba', quizCount: 1 },
  { _id: 'cat-general', name: 'General Knowledge', slug: 'general-knowledge', icon: 'globe-2', color: '#b29bff', quizCount: 3 },
]

const legacyCategoryBySlug = new Map(legacyDemoCategories.map(category => [category.slug, category]))
const subjectCategories = flattenSubjectCategories()
const subjectQuizzes = flattenSubjectQuizzes()
const subjectQuizCounts = subjectQuizzes.reduce((counts, quiz) => ({ ...counts, [quiz.category]: (counts[quiz.category] || 0) + 1 }), {})
const quizCountFor = slug => (subjectQuizCounts[slug] || 0) + (legacyCategoryBySlug.get(slug)?.quizCount || 0)

export const demoCategories = subjectCategories.map(category => ({
  ...category,
  _id: legacyCategoryBySlug.get(category.slug)?._id || `cat-${category.slug}`,
  color: category.color || legacyCategoryBySlug.get(category.slug)?.color,
  quizCount: (category.slug === category.rootSlug
    ? subjectCategories.filter(item => item.rootSlug === category.slug)
    : [category, ...subjectCategories.filter(item => item.parentSlug === category.slug)])
    .reduce((count, item) => count + quizCountFor(item.slug), 0),
}))

const demoCategoryBySlug = new Map(demoCategories.map(category => [category.slug, category]))

const makeQuestion = (id, text, options, correctAnswer, explanation) => ({ id, text, options, correctAnswer, explanation })

export const demoQuizzes = [
  {
    _id: 'demo-js', title: 'JavaScript, in practice', description: 'Test your grasp of the language that powers the web.',
    category: demoCategoryBySlug.get('javascript'), difficulty: 'Medium', timeLimit: 8, totalQuestions: 4, attemptsCount: 184, featured: true,
    questions: [
      makeQuestion('js-1', 'What does Array.prototype.map() return?', ['A new array', 'The original array', 'A number', 'Nothing'], 0, 'map creates a new array from the callback results.'),
      makeQuestion('js-2', 'Which value is not equal to itself?', ['NaN', 'undefined', 'null', '0'], 0, 'NaN is the only JavaScript value that is not equal to itself.'),
      makeQuestion('js-3', 'What does const prevent?', ['Reassignment of the binding', 'Changes to object properties', 'The variable from being read', 'Type coercion'], 0, 'const keeps the binding fixed, but referenced objects can still change.'),
      makeQuestion('js-4', 'Which method converts JSON text into a value?', ['JSON.parse()', 'JSON.stringify()', 'JSON.convert()', 'Object.fromJSON()'], 0, 'JSON.parse converts a JSON string into a JavaScript value.'),
    ],
  },
  {
    _id: 'demo-react', title: 'React essentials', description: 'A quick check on components, props, and state.',
    category: demoCategoryBySlug.get('react'), difficulty: 'Easy', timeLimit: 7, totalQuestions: 4, attemptsCount: 236, featured: true,
    questions: [
      makeQuestion('react-1', 'What is a React component?', ['A reusable UI building block', 'A CSS selector', 'A database table', 'A browser event'], 0, 'Components let you split a UI into independent, reusable pieces.'),
      makeQuestion('react-2', 'How is data commonly passed from parent to child?', ['Props', 'Refs only', 'Context menu', 'Query strings'], 0, 'Props are the standard mechanism for passing values down the component tree.'),
      makeQuestion('react-3', 'Which hook stores local component state?', ['useState', 'useFetch', 'useRoute', 'useClass'], 0, 'useState adds a state variable to a function component.'),
      makeQuestion('react-4', 'What should a list item have for stable rendering?', ['A unique key', 'An inline style', 'A ref', 'A fragment only'], 0, 'Keys help React identify list items between renders.'),
    ],
  },
  {
    _id: 'demo-data', title: 'Data science first principles', description: 'Reason about data, statistics, and model evaluation.',
    category: demoCategoryBySlug.get('data-science'), difficulty: 'Hard', timeLimit: 9, totalQuestions: 4, attemptsCount: 92, featured: true,
    questions: [
      makeQuestion('data-1', 'What does the median describe?', ['The middle value in ordered data', 'The most frequent value', 'The full range', 'The sum of values'], 0, 'The median is the central value after sorting observations.'),
      makeQuestion('data-2', 'What is a common purpose of a test set?', ['Estimate performance on unseen data', 'Choose every model feature', 'Replace training data', 'Increase sample size'], 0, 'A held-out test set approximates performance on unseen examples.'),
      makeQuestion('data-3', 'Which metric is often useful for imbalanced classes?', ['F1 score', 'Raw accuracy only', 'Mean squared error', 'R-squared'], 0, 'F1 balances precision and recall, which can be more informative with class imbalance.'),
      makeQuestion('data-4', 'What does correlation alone establish?', ['Association, not causation', 'Causation', 'A randomized experiment', 'No relationship'], 0, 'Correlation measures association but does not establish causal direction.'),
    ],
  },
  {
    _id: 'demo-html', title: 'HTML foundations', description: 'Semantic markup and the structure of a document.',
    category: demoCategoryBySlug.get('html'), difficulty: 'Easy', timeLimit: 6, totalQuestions: 4, attemptsCount: 147, featured: false,
    questions: [
      makeQuestion('html-1', 'Which element represents the main page content?', ['<main>', '<aside>', '<footer>', '<small>'], 0, 'The main element identifies the dominant content of a document.'),
      makeQuestion('html-2', 'What does the alt attribute provide on an image?', ['Text alternative', 'Image dimensions', 'A caption style', 'A download link'], 0, 'Alternative text communicates image content when it cannot be seen.'),
      makeQuestion('html-3', 'Which element is used for a page navigation region?', ['<nav>', '<menuitem>', '<route>', '<links>'], 0, 'nav groups major navigation links.'),
      makeQuestion('html-4', 'Where is metadata such as the document title placed?', ['<head>', '<header>', '<main>', '<section>'], 0, 'The head contains metadata and the document title.'),
    ],
  },
  {
    _id: 'demo-css', title: 'CSS layout lab', description: 'Explore the layout tools behind responsive interfaces.',
    category: demoCategoryBySlug.get('css'), difficulty: 'Medium', timeLimit: 7, totalQuestions: 4, attemptsCount: 113, featured: false,
    questions: [
      makeQuestion('css-1', 'Which layout system is designed for one-dimensional arrangements?', ['Flexbox', 'Grid', 'Float', 'Position'], 0, 'Flexbox is primarily suited to a row or a column of items.'),
      makeQuestion('css-2', 'Which unit is relative to the root font size?', ['rem', 'px', 'vh', 'cm'], 0, 'rem is based on the computed font size of the root element.'),
      makeQuestion('css-3', 'What does box-sizing: border-box include in the declared width?', ['Padding and border', 'Margin only', 'Content only', 'Outline'], 0, 'border-box includes content, padding, and border in the element width.'),
      makeQuestion('css-4', 'Which rule applies styles at a viewport breakpoint?', ['@media', '@supports only', '@container-query', '@viewport-size'], 0, '@media applies styles based on media features such as viewport width.'),
    ],
  },
  {
    _id: 'demo-python', title: 'Python building blocks', description: 'A refresher on Python syntax and collections.',
    category: demoCategoryBySlug.get('python'), difficulty: 'Easy', timeLimit: 7, totalQuestions: 4, attemptsCount: 168, featured: false,
    questions: [
      makeQuestion('py-1', 'Which collection is immutable?', ['Tuple', 'List', 'Set', 'Dictionary'], 0, 'Tuples cannot be changed after they are created.'),
      makeQuestion('py-2', 'What does len([1, 2, 3]) return?', ['3', '2', '4', 'None'], 0, 'len returns the number of items in the list.'),
      makeQuestion('py-3', 'Which keyword defines a function?', ['def', 'func', 'lambda only', 'method'], 0, 'A function statement begins with def.'),
      makeQuestion('py-4', 'What does a dictionary store?', ['Key-value pairs', 'Only ordered numbers', 'Unique values only', 'Functions only'], 0, 'Dictionaries map keys to values.'),
    ],
  },
  {
    _id: 'demo-general', title: 'Everyday essentials', description: 'A little of everything, from geography to simple maths.',
    category: demoCategoryBySlug.get('general-knowledge'), difficulty: 'Easy', timeLimit: 10, totalQuestions: 4, attemptsCount: 310, featured: true,
    questions: [
      makeQuestion('gen-1', 'Capital of France?', ['Paris', 'Rome', 'Berlin', 'Madrid'], 0, 'Paris is the capital and largest city of France.'),
      makeQuestion('gen-2', '5 + 5 = ?', ['10', '8', '9', '11'], 0, 'Five plus five equals ten.'),
      makeQuestion('gen-3', 'Largest planet?', ['Jupiter', 'Earth', 'Mars', 'Saturn'], 0, 'Jupiter is the largest planet in our solar system.'),
      makeQuestion('gen-4', 'Water freezes at?', ['0°C', '5°C', '10°C', '-5°C'], 0, 'At standard atmospheric pressure, water freezes at zero degrees Celsius.'),
    ],
  },
  ...subjectQuizzes.map((quiz, index) => ({
    _id: `demo-subject-${quiz.category}-${quiz.difficulty.toLowerCase()}`,
    title: quiz.title,
    description: quiz.description,
    category: demoCategoryBySlug.get(quiz.category),
    difficulty: quiz.difficulty,
    timeLimit: quiz.timeLimit,
    totalQuestions: quiz.questions.length,
    attemptsCount: 0,
    featured: false,
    questions: quiz.questions.map((item, questionIndex) => makeQuestion(
      `subject-${index}-${questionIndex}`,
      item.text,
      item.options,
      item.correctAnswer,
      item.explanation,
    )),
  })),
]

export const demoLeaderboard = [
  { rank: 1, name: 'Avery K.', score: 15, percentage: 100, quiz: 'JavaScript, in practice', category: 'JavaScript', date: '2026-09-28' },
  { rank: 2, name: 'Jordan M.', score: 14, percentage: 93, quiz: 'React essentials', category: 'React', date: '2026-09-27' },
  { rank: 3, name: 'Sam R.', score: 13, percentage: 87, quiz: 'Data science first principles', category: 'Data Science', date: '2026-09-26' },
  { rank: 4, name: 'Taylor P.', score: 12, percentage: 80, quiz: 'CSS layout lab', category: 'CSS', date: '2026-09-25' },
  { rank: 5, name: 'Morgan L.', score: 11, percentage: 73, quiz: 'Python building blocks', category: 'Python', date: '2026-09-24' },
]