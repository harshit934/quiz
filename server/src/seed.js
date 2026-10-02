import User from './models/User.js'
import Category from './models/Category.js'
import Quiz from './models/Quiz.js'
import Question from './models/Question.js'
import { flattenSubjectCategories, flattenSubjectQuizzes } from '../../shared/subjectCatalog.js'

const legacyBanks = {
  Easy: [
    ['Capital of France?', ['Paris', 'Rome', 'Berlin', 'Madrid']], ['5 + 5 = ?', ['10', '8', '9', '11']], ['Sky color?', ['Blue', 'Green', 'Red', 'Yellow']],
    ['2 x 3 = ?', ['6', '5', '4', '7']], ['Largest planet?', ['Jupiter', 'Earth', 'Mars', 'Saturn']], ['Water freezes at?', ['0°C', '5°C', '10°C', '-5°C']],
    ['Opposite of hot?', ['Cold', 'Warm', 'Cool', 'Heat']], ['7 days make a?', ['Week', 'Month', 'Year', 'Hour']], ['Animal that barks?', ['Dog', 'Cat', 'Cow', 'Goat']],
    ['1 dozen equals?', ['12', '10', '6', '8']], ['Sun rises in?', ['East', 'West', 'North', 'South']], ['Square sides?', ['4', '3', '5', '6']],
    ['10 - 4 = ?', ['6', '5', '7', '8']], ['Which is fruit?', ['Apple', 'Carrot', 'Onion', 'Potato']], ['Hours in day?', ['24', '12', '48', '36']],
  ],
  Medium: [
    ['Who discovered gravity?', ['Newton', 'Einstein', 'Tesla', 'Galileo']], ['Largest ocean?', ['Pacific', 'Atlantic', 'Indian', 'Arctic']], ['Square root of 144?', ['12', '14', '10', '16']],
    ['Gold symbol?', ['Au', 'Ag', 'Gd', 'Go']], ['Who wrote Hamlet?', ['Shakespeare', 'Dickens', 'Austen', 'Homer']], ['Hardest natural substance?', ['Diamond', 'Gold', 'Iron', 'Silver']],
    ['H2O is?', ['Water', 'Oxygen', 'Hydrogen', 'Salt']], ['Largest desert?', ['Sahara', 'Gobi', 'Kalahari', 'Arctic']], ['Human bones?', ['206', '210', '201', '190']],
    ['Mona Lisa painter?', ['Da Vinci', 'Van Gogh', 'Picasso', 'Michelangelo']], ['Smallest prime?', ['2', '1', '3', '5']], ['First man on moon?', ['Neil Armstrong', 'Buzz Aldrin', 'Yuri', 'John']],
    ['WWII ended?', ['1945', '1939', '1918', '1950']], ['Heart pumps?', ['Blood', 'Water', 'Air', 'Oxygen']], ['Binary of 2?', ['10', '11', '01', '100']],
  ],
  Hard: [
    ['E=mc² by?', ['Einstein', 'Newton', 'Bohr', 'Tesla']], ['Derivative of x²?', ['2x', 'x', 'x²', '2']], ['Longest river?', ['Nile', 'Amazon', 'Yangtze', 'Mississippi']],
    ['CPU stands for?', ['Central Processing Unit', 'Control Unit', 'Computer Unit', 'Power Unit']], ['Pi approx?', ['3.1416', '3.1214', '3.1514', '3.4116']], ['First programmer?', ['Ada Lovelace', 'Turing', 'Jobs', 'Gates']],
    ['Atomic number of Carbon?', ['6', '8', '12', '4']], ['Binary search complexity?', ['O(log n)', 'O(n)', 'O(n²)', 'O(1)']], ['Boiling point water?', ['100°C', '90°C', '110°C', '120°C']],
    ['Binary of 10?', ['1010', '1001', '1100', '1110']], ['Neutral pH?', ['7', '5', '9', '1']], ['Planet with most moons?', ['Saturn', 'Earth', 'Mars', 'Venus']],
    ['HTML used for?', ['Structure', 'Styling', 'Database', 'Server']], ['Speed of light?', ['300,000 km/s', '150,000', '1,000', '3,000']], ['Heaviest natural element?', ['Uranium', 'Gold', 'Iron', 'Silver']],
  ],
}

const starterQuizzes = [
  {
    title: 'JavaScript, in practice', category: 'javascript', difficulty: 'Medium', timeLimit: 8, featured: true,
    description: 'Test your grasp of the language that powers the web.', questions: [
      ['What does Array.prototype.map() return?', ['A new array', 'The original array', 'A number', 'Nothing'], 0, 'map creates a new array from the callback results.'],
      ['Which value is not equal to itself?', ['NaN', 'undefined', 'null', '0'], 0, 'NaN is the only JavaScript value that is not equal to itself.'],
      ['What does const prevent?', ['Reassignment of the binding', 'Changes to object properties', 'The variable from being read', 'Type coercion'], 0, 'const keeps the binding fixed, but referenced objects can still change.'],
      ['Which method converts JSON text into a value?', ['JSON.parse()', 'JSON.stringify()', 'JSON.convert()', 'Object.fromJSON()'], 0, 'JSON.parse converts a JSON string into a JavaScript value.'],
    ],
  },
  {
    title: 'React essentials', category: 'react', difficulty: 'Easy', timeLimit: 7, featured: true,
    description: 'A quick check on components, props, and state.', questions: [
      ['What is a React component?', ['A reusable UI building block', 'A CSS selector', 'A database table', 'A browser event'], 0, 'Components let you split a UI into independent, reusable pieces.'],
      ['How is data commonly passed from parent to child?', ['Props', 'Refs only', 'Context menu', 'Query strings'], 0, 'Props are the standard mechanism for passing values down the component tree.'],
      ['Which hook stores local component state?', ['useState', 'useFetch', 'useRoute', 'useClass'], 0, 'useState adds a state variable to a function component.'],
      ['What should a list item have for stable rendering?', ['A unique key', 'An inline style', 'A ref', 'A fragment only'], 0, 'Keys help React identify list items between renders.'],
    ],
  },
  {
    title: 'HTML foundations', category: 'html', difficulty: 'Easy', timeLimit: 6, featured: false,
    description: 'Semantic markup and the structure of a document.', questions: [
      ['Which element represents the main page content?', ['<main>', '<aside>', '<footer>', '<small>'], 0, 'The main element identifies the dominant content of a document.'],
      ['What does the alt attribute provide on an image?', ['Text alternative', 'Image dimensions', 'A caption style', 'A download link'], 0, 'Alternative text communicates image content when it cannot be seen.'],
      ['Which element is used for a page navigation region?', ['<nav>', '<menuitem>', '<route>', '<links>'], 0, 'nav groups major navigation links.'],
      ['Where is metadata such as the document title placed?', ['<head>', '<header>', '<main>', '<section>'], 0, 'The head contains metadata and the document title.'],
    ],
  },
  {
    title: 'CSS layout lab', category: 'css', difficulty: 'Medium', timeLimit: 7, featured: false,
    description: 'Explore the layout tools behind responsive interfaces.', questions: [
      ['Which layout system is designed for one-dimensional arrangements?', ['Flexbox', 'Grid', 'Float', 'Position'], 0, 'Flexbox is primarily suited to a row or a column of items.'],
      ['Which unit is relative to the root font size?', ['rem', 'px', 'vh', 'cm'], 0, 'rem is based on the computed font size of the root element.'],
      ['What does box-sizing: border-box include in the declared width?', ['Padding and border', 'Margin only', 'Content only', 'Outline'], 0, 'border-box includes content, padding, and border in the element width.'],
      ['Which rule applies styles at a viewport breakpoint?', ['@media', '@supports only', '@container-query', '@viewport-size'], 0, '@media applies styles based on media features such as viewport width.'],
    ],
  },
  {
    title: 'Python building blocks', category: 'python', difficulty: 'Easy', timeLimit: 7, featured: false,
    description: 'A friendly refresher on Python syntax and collections.', questions: [
      ['Which collection is immutable?', ['Tuple', 'List', 'Set', 'Dictionary'], 0, 'Tuples cannot be changed after they are created.'],
      ['What does len([1, 2, 3]) return?', ['3', '2', '4', 'None'], 0, 'len returns the number of items in the list.'],
      ['Which keyword defines a function?', ['def', 'func', 'lambda only', 'method'], 0, 'A function statement begins with def.'],
      ['What does a dictionary store?', ['Key-value pairs', 'Only ordered numbers', 'Unique values only', 'Functions only'], 0, 'Dictionaries map keys to values.'],
    ],
  },
  {
    title: 'Data science first principles', category: 'data-science', difficulty: 'Hard', timeLimit: 9, featured: true,
    description: 'Reason about data, statistics, and model evaluation.', questions: [
      ['What does the median describe?', ['The middle value in ordered data', 'The most frequent value', 'The full range', 'The sum of values'], 0, 'The median is the central value after sorting observations.'],
      ['What is a common purpose of a test set?', ['Estimate performance on unseen data', 'Choose every model feature', 'Replace training data', 'Increase sample size'], 0, 'A held-out test set approximates performance on unseen examples.'],
      ['Which metric is often useful for imbalanced classes?', ['F1 score', 'Raw accuracy only', 'Mean squared error', 'R-squared'], 0, 'F1 balances precision and recall, which can be more informative with class imbalance.'],
      ['What does correlation alone establish?', ['Association, not causation', 'Causation', 'A randomized experiment', 'No relationship'], 0, 'Correlation measures association but does not establish causal direction.'],
    ],
  },
]

export async function seedAdminAccount({ username = process.env.ADMIN_USERNAME, email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD } = {}) {
  const normalizedUsername = username?.trim().toLowerCase()
  if (!password) return null

  if (normalizedUsername) {
    if (!/^[a-z0-9._-]{3,40}$/.test(normalizedUsername)) {
      console.error('ADMIN_USERNAME must be 3-40 characters and contain only letters, numbers, dots, underscores, or hyphens.')
      return null
    }
    const normalizedEmail = `${normalizedUsername}@quizly.local`
    const [userByUsername, userByEmail] = await Promise.all([
      User.findOne({ username: normalizedUsername }),
      User.findOne({ email: normalizedEmail }),
    ])
    if (userByUsername && userByEmail && String(userByUsername._id) !== String(userByEmail._id)) {
      console.error('Admin account was not provisioned because ADMIN_USERNAME conflicts with an existing account.')
      return null
    }
    const existing = userByUsername || userByEmail
    if (existing) {
      if (existing.role !== 'admin') {
        console.error('Admin account was not provisioned because ADMIN_USERNAME belongs to a non-admin account.')
        return null
      }
      return existing
    }
    const user = await User.create({ name: normalizedUsername, username: normalizedUsername, email: normalizedEmail, password, role: 'admin' })
    console.info(`Created initial administrator account for ${normalizedUsername}.`)
    return user
  }

  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return null
  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) return existing
  const user = await User.create({ name: 'Platform Admin', email: normalizedEmail, password, role: 'admin' })
  console.info(`Created initial administrator account for ${normalizedEmail}.`)
  return user
}

export async function seedStarterContent() {
  const categoryData = flattenSubjectCategories()
  await Promise.all(categoryData.map(({ parentSlug, rootSlug, legacy, ...category }) => Category.updateOne(
    { slug: category.slug },
    { $set: { parentSlug, rootSlug }, $setOnInsert: category },
    { upsert: true },
  )))

  const categoryBySlug = new Map((await Category.find().lean()).map(category => [category.slug, category]))
  const quizData = [
    ...Object.entries(legacyBanks).map(([difficulty, questions]) => ({
      title: `${difficulty} general knowledge`,
      description: `The original ${difficulty.toLowerCase()} question set, preserved from your quiz app.`,
      category: 'general-knowledge', difficulty, timeLimit: 10, featured: difficulty === 'Easy',
      questions: questions.map(([text, options]) => ({ text, options, correctAnswer: 0, explanation: 'Review the options and use this round to sharpen your general knowledge.' })),
    })),
    ...starterQuizzes.map(item => ({
      ...item,
      questions: item.questions.map(([text, options, correctAnswer, explanation]) => ({ text, options, correctAnswer, explanation })),
    })),
    ...flattenSubjectQuizzes(),
  ]

  for (const item of quizData) {
    const category = categoryBySlug.get(item.category)
    if (!category) throw new Error(`Seed category not found: ${item.category}`)

    let quiz = await Quiz.findOne({ title: item.title, category: category._id })
    if (!quiz) {
      quiz = await Quiz.create({
        title: item.title,
        description: item.description,
        category: category._id,
        difficulty: item.difficulty,
        timeLimit: item.timeLimit,
        featured: item.featured,
        totalQuestions: item.questions.length,
        questions: [],
      })
    }

    if (!quiz.questions.length) {
      const questions = await Question.insertMany(item.questions.map((question, position) => ({
        ...question, quiz: quiz._id, position,
      })))
      quiz.questions = questions.map(question => question._id)
      quiz.totalQuestions = questions.length
      await quiz.save()
    }
  }

  await seedAdminAccount()
}