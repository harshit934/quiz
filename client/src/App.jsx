import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertCircle,
  BookOpenCheck,
  LoaderCircle,
  Moon,
  Sun,
} from 'lucide-react'

import Navbar from './components/Navbar.jsx'
import AdminQuestionsPage from './AdminQuestionsPage.jsx'
import AdminExamsPage from './AdminExamsPage.jsx'
import ExamsPage from './ExamsPage.jsx'
import AuthenticatedCoding from './AuthenticatedCoding.jsx'
import { exploreRoute } from './utils/exploreRoute.js'
import { LoadingState, Toast } from './components/ui.jsx'
import { demoCategories, demoQuizzes } from './data/demoData.js'
import { fisherYates } from './utils/shuffle.js'
import {
  clearToken,
  getToken,
  isOfflineError,
  readLocalAttempts,
  request,
  saveLocalAttempt,
  setToken,
} from './services/api.js'

import {
  AdminPage,
  AuthPage,
  DashboardPage,
  ExplorePage,
  HomePage,
  LeaderboardPage,
  QuizPage,
  ResultPage,
} from './pages.jsx'

const defaultStats = {
  users: 0,
  quizzes: demoQuizzes.length,
  questions: demoQuizzes.reduce(
    (sum, quiz) => sum + quiz.totalQuestions,
    0
  ),
  categories: demoCategories.length,
}

function prepareQuiz(quiz) {
  return {
    ...quiz,
    questions: fisherYates(quiz.questions || []),
  }
}

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('quizly-user') || 'null')
  } catch {
    return null
  }
}

function defaultRoute() {
  const token = getToken()
  const user = storedUser()
  if (!token || token === 'demo-session' || !user) return '#login'
  return user.role === 'admin' ? '#admin/dashboard' : '#dashboard'
}

function localDashboard(user) {
  const attempts = readLocalAttempts().filter(
    item => !item.userId || item.userId === user?.id
  )

  const quizzesCompleted = attempts.length

  const averageScore = quizzesCompleted
    ? Math.round(
        attempts.reduce((sum, item) => sum + item.percentage, 0) /
          quizzesCompleted
      )
    : 0

  const bestScore = quizzesCompleted
    ? Math.max(...attempts.map(item => item.percentage))
    : 0

  const totalCorrect = attempts.reduce(
    (sum, item) => sum + item.correctCount,
    0
  )

  const achievementData = [
    ['first-quiz', 'First steps', 'Complete your first quiz.', 1],
    [
      'perfect-score',
      'Perfect score',
      'Earn 100% on a quiz.',
      attempts.some(item => item.percentage === 100) ? 1 : 0,
    ],
    [
      'five-quizzes',
      'Finding your rhythm',
      'Complete five quizzes.',
      quizzesCompleted,
    ],
    [
      'ten-quizzes',
      'Dedicated learner',
      'Complete ten quizzes.',
      quizzesCompleted,
    ],
    [
      'three-in-a-row',
      'On a roll',
      'Complete three quizzes in a row.',
      Math.min(quizzesCompleted, 3),
    ],
  ]

  return {
    stats: {
      quizzesCompleted,
      averageScore,
      bestScore,
      totalCorrect,
    },

    recentAttempts: attempts.slice(0, 6),

    scoreHistory: [...attempts]
      .reverse()
      .slice(-12)
      .map(item => ({
        date: item.createdAt,
        score: item.percentage,
        title: item.quiz?.title,
      })),

    categoryPerformance: Object.values(
      attempts.reduce((groups, item) => {
        const name = item.quiz?.category?.name || 'General Knowledge'

        groups[name] ||= {
          name,
          quizzes: 0,
          total: 0,
        }

        groups[name].quizzes += 1
        groups[name].total += item.percentage

        return groups
      }, {})
    ).map(item => ({
      ...item,
      score: Math.round(item.total / item.quizzes),
    })),

    difficultyPerformance: Object.values(
      attempts.reduce((groups, item) => {
        const name = item.quiz?.difficulty || 'Easy'

        groups[name] ||= {
          name,
          quizzes: 0,
          total: 0,
        }

        groups[name].quizzes += 1
        groups[name].total += item.percentage

        return groups
      }, {})
    ).map(item => ({
      ...item,
      score: Math.round(item.total / item.quizzes),
    })),

    achievements: achievementData.map(
      ([code, title, detail, value]) => {
        const goals = {
          'first-quiz': 1,
          'perfect-score': 1,
          'five-quizzes': 5,
          'ten-quizzes': 10,
          'three-in-a-row': 3,
        }

        const goal = goals[code]

        return {
          code,
          title,
          detail,
          goal,
          earned: value >= goal,
          progress: Math.min(
            100,
            Math.round((value / goal) * 100)
          ),
        }
      }
    ),
  }
}

export default function App() {
  const [route, setRoute] = useState(
    window.location.hash || defaultRoute()
  )

  const [user, setUser] = useState(storedUser)

  const [theme, setTheme] = useState(
    () => localStorage.getItem('quizly-theme') === 'dark' ? 'dark' : 'light'
  )

  const [adminVerified, setAdminVerified] = useState(false)

  const [adminCheckStatus, setAdminCheckStatus] =
    useState('idle')

  const [categories, setCategories] =
    useState(demoCategories)

  const [quizzes, setQuizzes] =
    useState(demoQuizzes)

  const [stats, setStats] =
    useState(defaultStats)

  const [leaderboard, setLeaderboard] = useState([])

  const [leaderboardCategory, setLeaderboardCategory] =
    useState('')

  const [dashboard, setDashboard] = useState(null)

  const [adminStats, setAdminStats] = useState(null)

  const [adminUsers, setAdminUsers] = useState([])

  const [adminQuizStats, setAdminQuizStats] = useState([])

  const [leaderboardOffline, setLeaderboardOffline] =
    useState(false)

  const [loadingDashboard, setLoadingDashboard] =
    useState(false)

  const [loadingAdmin, setLoadingAdmin] =
    useState(false)

  const [catalogReady, setCatalogReady] =
    useState(false)

  const [activeQuiz, setActiveQuiz] = useState(null)

  const [quizLoadError, setQuizLoadError] =
    useState('')

  const quizLoadRef = useRef(null)

  const pendingRouteRef = useRef(null)

  const pendingQuizRef = useRef(null)

  const [result, setResult] = useState(null)

  const [toast, setToast] = useState('')

  const [catalogError, setCatalogError] =
    useState('')

  const [saving, setSaving] = useState(false)

  const routeParts = route.slice(1).split('/')

  const [routeName, routeId] = routeParts

  useEffect(() => {
    if (routeName === 'explore' && routeId && exploreRoute(routeId) === '#explore') {
      window.location.hash = '#explore'
    }
  }, [routeName, routeId])

  const isAuthenticated = Boolean(
    user &&
      getToken() &&
      getToken() !== 'demo-session'
  )

  const navigate = useCallback(target => {
    if (window.location.hash !== target) {
      window.location.hash = target
    } else {
      setRoute(target)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('quizly-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    const syncRoute = () =>
      setRoute(window.location.hash || defaultRoute())

    window.addEventListener('hashchange', syncRoute)

    return () =>
      window.removeEventListener(
        'hashchange',
        syncRoute
      )
  }, [])

  useEffect(() => {
    if (isAuthenticated) return

    if (routeName === 'quiz' && routeId) {
      pendingQuizRef.current = quizzes.find(quiz => String(quiz._id) === routeId) || { _id: routeId }
      pendingRouteRef.current = `#quiz/${routeId}`
      navigate('#login')
    } else if (routeName === 'exams' || routeName === 'coding') {
      pendingRouteRef.current = route
      navigate('#login')
    }
  }, [
    isAuthenticated,
    navigate,
    quizzes,
    route,
    routeId,
    routeName,
  ])

  useEffect(() => {
    if (
      user?.role !== 'admin' ||
      adminVerified
    ) {
      return
    }

    let current = true

    setAdminCheckStatus('checking')

    request('/users/profile')
      .then(profile => {
        if (!current) return

        localStorage.setItem(
          'quizly-user',
          JSON.stringify(profile)
        )

        setUser(profile)

        setAdminVerified(
          profile.role === 'admin'
        )

        setAdminCheckStatus(
          profile.role === 'admin'
            ? 'verified'
            : 'denied'
        )
      })
      .catch(error => {
        if (!current) return

        if (error.status === 401) {
          clearToken()

          localStorage.removeItem(
            'quizly-user'
          )

          setUser(null)
        }

        setAdminCheckStatus('denied')
      })

    return () => {
      current = false
    }
  }, [user, adminVerified])

  /*
   * FIXED API CATALOG LOADING
   *
   * The old version immediately showed the offline
   * message when either categories OR quizzes failed.
   *
   * This version:
   * 1. Loads categories, quizzes and stats.
   * 2. Retries once if BOTH categories and quizzes fail.
   * 3. Keeps successful API responses.
   * 4. Only shows the offline banner when BOTH
   *    categories and quizzes are actually unavailable.
   */
  const loadCatalog = useCallback(async () => {
    const load = async () => {
      return Promise.allSettled([
        request('/categories'),
        request('/quizzes'),
        request('/stats'),
      ])
    }

    let results = await load()

    let [
      categoryResult,
      quizResult,
      statsResult,
    ] = results

    const categoriesFailed =
      categoryResult.status === 'rejected'

    const quizzesFailed =
      quizResult.status === 'rejected'

    /*
     * Render can take a little time to wake up.
     * If both catalog endpoints fail, wait 1.5 seconds
     * and try once more.
     */
    if (categoriesFailed && quizzesFailed) {
      await new Promise(resolve =>
        setTimeout(resolve, 1500)
      )

      results = await load()

      ;[
        categoryResult,
        quizResult,
        statsResult,
      ] = results
    }

    /*
     * Use real categories when available.
     */
    if (
      categoryResult.status === 'fulfilled' &&
      Array.isArray(categoryResult.value) &&
      categoryResult.value.length
    ) {
      setCategories(categoryResult.value)
    }

    /*
     * Use real quizzes when available.
     */
    if (
      quizResult.status === 'fulfilled' &&
      Array.isArray(quizResult.value) &&
      quizResult.value.length
    ) {
      setQuizzes(quizResult.value)
    }

    /*
     * Stats are independent.
     * A stats failure should NOT make the entire
     * catalog appear offline.
     */
    if (
      statsResult.status === 'fulfilled'
    ) {
      setStats(statsResult.value)
    }

    /*
     * Only display the offline banner if BOTH
     * important catalog endpoints failed.
     */
    const categoriesStillFailed =
      categoryResult.status === 'rejected'

    const quizzesStillFailed =
      quizResult.status === 'rejected'

    if (
      categoriesStillFailed &&
      quizzesStillFailed
    ) {
      setCatalogError(
        'The API is offline, so you are browsing the included demo quizzes.'
      )
    } else {
      setCatalogError('')
    }

    setCatalogReady(true)
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (!catalogError) return

    const retry = window.setInterval(() => {
      loadCatalog()
    }, 15000)

    return () => window.clearInterval(retry)
  }, [catalogError, loadCatalog])

  useEffect(() => {
    if (
      routeName === 'dashboard' &&
      user
    ) {
      setLoadingDashboard(true)

      const offline = localDashboard(user)

      if (
        getToken() === 'demo-session'
      ) {
        setDashboard(offline)
        setLoadingDashboard(false)
      } else {
        request('/users/dashboard')
          .then(setDashboard)
          .catch(() => setDashboard(offline))
          .finally(() =>
            setLoadingDashboard(false)
          )
      }
    }

    if (
      routeName === 'admin' &&
      user?.role === 'admin' &&
      adminVerified
    ) {
      setLoadingAdmin(true)

      Promise.all([
        request('/admin/stats'),
        request('/admin/users'),
        request('/admin/stats/quizzes'),
      ])
        .then(
          ([
            overview,
            users,
            quizPerformance,
          ]) => {
            setAdminStats(overview)
            setAdminUsers(users)
            setAdminQuizStats(
              quizPerformance
            )
          }
        )
        .catch(() => {
          setAdminStats(null)
          setAdminUsers([])
          setAdminQuizStats([])
        })
        .finally(() =>
          setLoadingAdmin(false)
        )
    }

    if (routeName === 'leaderboard') {
      const query = leaderboardCategory
        ? `?category=${encodeURIComponent(
            leaderboardCategory
          )}`
        : ''

      request(`/leaderboard${query}`)
        .then(entries => {
          setLeaderboard(entries)
          setLeaderboardOffline(false)
        })
        .catch(() => {
          setLeaderboard([])
          setLeaderboardOffline(true)
        })
    }
  }, [
    routeName,
    routeId,
    user,
    adminVerified,
    leaderboardCategory,
  ])

  useEffect(() => {
    if (
      routeName === 'result' &&
      routeId &&
      !result
    ) {
      const local =
        readLocalAttempts().find(
          attempt =>
            attempt._id === routeId
        )

      if (local) {
        setResult(local)
      } else {
        request(`/attempts/${routeId}`)
          .then(setResult)
          .catch(() =>
            navigate('#dashboard')
          )
      }
    }
  }, [
    navigate,
    result,
    routeId,
    routeName,
  ])

  useEffect(() => {
    if (
      routeName !== 'quiz' ||
      !routeId ||
      activeQuiz?._id === routeId ||
      quizLoadRef.current === routeId
    ) {
      return
    }

    const demoQuiz =
      demoQuizzes.find(
        quiz => quiz._id === routeId
      )

    setQuizLoadError('')

    if (demoQuiz) {
      setActiveQuiz(
        prepareQuiz(demoQuiz)
      )

      return
    }

    quizLoadRef.current = routeId

    request(`/quizzes/${routeId}`)
      .then(quiz =>
        setActiveQuiz(
          prepareQuiz(quiz)
        )
      )
      .catch(error =>
        setQuizLoadError(
          error.message
        )
      )
      .finally(() => {
        quizLoadRef.current = null
      })
  }, [
    activeQuiz,
    routeId,
    routeName,
  ])

  const toastMessage = useMemo(
    () => toast,
    [toast]
  )

  const notify = useCallback(
    message => setToast(message),
    []
  )

  function signOut() {
    clearToken()

    localStorage.removeItem(
      'quizly-user'
    )

    setUser(null)

    setAdminVerified(false)

    setAdminCheckStatus('idle')

    setDashboard(null)

    navigate('#home')

    notify('You are signed out.')
  }

  async function submitAuth(
    payload,
    mode
  ) {
    const data = await request(
      `/auth/${mode}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )

    applyAuth(data, mode)
  }

  async function submitGoogleAuth(credential) {
    const data = await request(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ credential }),
      }
    )

    applyAuth(data, 'google')
  }

  function applyAuth(data, mode) {
    setToken(data.token)

    localStorage.setItem(
      'quizly-user',
      JSON.stringify(data.user)
    )

    setUser(data.user)

    setAdminVerified(
      data.user.role === 'admin'
    )

    setAdminCheckStatus(
      data.user.role === 'admin'
        ? 'verified'
        : 'idle'
    )

    setResult(null)

    const pendingRoute = pendingRouteRef.current
    const pendingQuiz = pendingQuizRef.current
    pendingRouteRef.current = null
    pendingQuizRef.current = null

    if (
      data.user.role !== 'admin' &&
      pendingRoute?.startsWith('#quiz/')
    ) {
      startQuiz(
        pendingQuiz || {
          _id: pendingRoute.slice('#quiz/'.length),
        },
        data.user
      )
    } else {
      navigate(
        pendingRoute?.startsWith('#coding')
          ? pendingRoute
          : data.user.role === 'admin'
          ? '#admin/dashboard'
          : pendingRoute || '#dashboard'
      )
    }

    notify(mode === 'register' ? 'Your account is ready.' : 'Welcome back.')
  }

  function continueDemo() {
    pendingRouteRef.current = null
    pendingQuizRef.current = null

    const demoUser = {
      id: 'demo-user',
      name: 'Demo Learner',
      email: 'learner@quizly.demo',
      role: 'user',
    }

    setToken('demo-session')

    localStorage.setItem(
      'quizly-user',
      JSON.stringify(demoUser)
    )

    setUser(demoUser)

    setAdminVerified(false)

    setAdminCheckStatus('idle')

    setDashboard(
      localDashboard(demoUser)
    )

    navigate('#dashboard')

    notify(
      'You are exploring with a local demo profile.'
    )
  }

  async function startQuiz(quiz, userForStart = user) {
    if (!userForStart || !getToken() || getToken() === 'demo-session') {
      pendingQuizRef.current = quiz
      pendingRouteRef.current = `#quiz/${quiz._id}`
      setActiveQuiz(null)
      navigate('#login')
      notify('Sign in to start a quiz.')
      return
    }
    try {
      const profile = await request('/users/profile')
      setUser(profile)
      localStorage.setItem('quizly-user', JSON.stringify(profile))
    } catch (error) {
      if (error.status === 401) {
        clearToken()
        localStorage.removeItem('quizly-user')
        setUser(null)
        pendingQuizRef.current = quiz
        pendingRouteRef.current = `#quiz/${quiz._id}`
        navigate('#login')
        notify('Your session has expired. Sign in to start a quiz.')
      } else notify(`Unable to verify your session. ${error.message}`)
      return
    }
    setResult(null)

    setActiveQuiz(null)

    setQuizLoadError('')

    navigate(`#quiz/${quiz._id}`)

    if (
      String(quiz._id).startsWith('demo-')
    ) {
      setActiveQuiz(
        prepareQuiz(quiz)
      )

      return
    }

    quizLoadRef.current =
      String(quiz._id)

    try {
      setActiveQuiz(
        prepareQuiz(
          await request(
            `/quizzes/${quiz._id}`
          )
        )
      )
    } catch (error) {
      setActiveQuiz(
        quiz.questions?.length
          ? prepareQuiz(quiz)
          : null
      )

      if (!quiz.questions?.length) {
        setQuizLoadError(
          error.message
        )
      }
    } finally {
      quizLoadRef.current = null
    }
  }

  function makeLocalAttempt(
    quiz,
    payload
  ) {
    const answers =
      quiz.questions.map(question => {
        const id =
          question.id ||
          question._id

        const selectedOption =
          payload.answers[id] || ''

        return {
          question,
          selectedOption,
        }
      })

    const correctCount =
      answers.filter(
        item =>
          item.selectedOption &&
          item.selectedOption ===
            item.question.options[
              item.question.correctAnswer
            ]
      ).length

    const incorrectCount =
      answers.filter(
        item =>
          item.selectedOption &&
          item.selectedOption !==
            item.question.options[
              item.question.correctAnswer
            ]
      ).length

    const unansweredCount =
      answers.length -
      correctCount -
      incorrectCount

    const percentage = Math.round(
      (correctCount /
        Math.max(
          1,
          answers.length
        )) *
        100
    )

    return {
      _id: `local-${Date.now()}`,
      userId: user?.id,
      quiz,
      answers,
      markedQuestions:
        payload.markedQuestionIds,
      score: correctCount,
      percentage,
      correctCount,
      incorrectCount,
      unansweredCount,
      timeTaken: payload.timeTaken,
      passed: percentage >= 60,
      createdAt:
        new Date().toISOString(),
    }
  }

  async function completeQuiz(
    quiz,
    payload
  ) {
    if (!isAuthenticated) {
      pendingQuizRef.current = quiz
      pendingRouteRef.current = `#quiz/${quiz._id}`
      setActiveQuiz(null)
      navigate('#login')
      notify('Sign in to submit your quiz.')
      return
    }
    const answers = Object.entries(
      payload.answers
    ).map(
      ([
        questionId,
        selectedOption,
      ]) => ({
        questionId,
        selectedOption,
      })
    )

    let completed
    let savedToServer = false

    if (
      String(quiz._id).startsWith(
        'demo-'
      )
    ) {
      completed =
        makeLocalAttempt(
          quiz,
          payload
        )
    } else {
      try {
        completed = await request(
          '/attempts',
          {
            method: 'POST',
            body: JSON.stringify({
              quizId: quiz._id,
              answers,
              markedQuestionIds:
                payload.markedQuestionIds,
              timeTaken:
                payload.timeTaken,
            }),
          }
        )

        savedToServer = true
      } catch (error) {
        if (error.status === 401) {
          clearToken()
          localStorage.removeItem('quizly-user')
          setUser(null)
          pendingQuizRef.current = quiz
          pendingRouteRef.current = `#quiz/${quiz._id}`
          setActiveQuiz(null)
          navigate('#login')
          notify('Your session has expired. Sign in to submit your quiz.')
          return
        }

        notify(`Your quiz could not be graded. Please try again. ${error.message}`)
        throw error
      }
    }

    if (!completed) {
      completed =
        makeLocalAttempt(
          quiz,
          payload
        )
    }

    saveLocalAttempt({
      ...completed,
      userId: user?.id,
    })

    if (savedToServer) {
      notify(
        'Your result has been saved.'
      )
    }

    setResult(completed)

    setActiveQuiz(null)

    navigate(
      `#result/${completed._id}`
    )
  }

  async function openAttempt(
    attempt
  ) {
    if (
      attempt.answers?.some(
        answer =>
          answer.question?.text
      )
    ) {
      setResult(attempt)

      navigate(
        `#result/${attempt._id}`
      )

      return
    }

    try {
      const detail = await request(
        `/attempts/${attempt._id}`
      )

      setResult(detail)

      navigate(
        `#result/${attempt._id}`
      )
    } catch {
      setResult(attempt)

      navigate(
        `#result/${attempt._id}`
      )
    }
  }

  async function saveQuiz(
    payload,
    editing
  ) {
    const path = editing
      ? `/quizzes/${editing._id}`
      : '/quizzes'

    await request(path, {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })

    await loadCatalog()

    notify(
      editing
        ? 'Quiz updated.'
        : 'Quiz created.'
    )
  }

  async function deleteQuiz(
    quiz
  ) {
    if (
      !window.confirm(
        `Delete “${quiz.title}”? Completed results will remain in learner history.`
      )
    ) {
      return
    }

    try {
      await request(
        `/quizzes/${quiz._id}`,
        {
          method: 'DELETE',
        }
      )

      await loadCatalog()

      notify('Quiz deleted.')
    } catch (error) {
      notify(error.message)
    }
  }

  async function saveCategory(
    name,
    category = null
  ) {
    try {
      await request(
        category
          ? `/categories/${category._id}`
          : '/categories',
        {
          method: category
            ? 'PUT'
            : 'POST',

          body: JSON.stringify(
            category
              ? {
                  ...category,
                  name,
                }
              : {
                  name,
                }
          ),
        }
      )

      await loadCatalog()

      notify(
        category
          ? 'Category updated.'
          : 'Category created.'
      )
    } catch (error) {
      notify(error.message)

      throw error
    }
  }

  async function deleteCategory(
    category
  ) {
    if (
      !window.confirm(
        `Delete the ${category.name} category?`
      )
    ) {
      return
    }

    try {
      await request(
        `/categories/${category._id}`,
        {
          method: 'DELETE',
        }
      )

      await loadCatalog()

      notify('Category deleted.')
    } catch (error) {
      notify(error.message)
    }
  }

  async function loadFullQuiz(
    quiz
  ) {
    try {
      return await request(
        `/quizzes/${quiz._id}`
      )
    } catch {
      return quiz
    }
  }

  async function saveQuestion(
    quizId,
    question,
    questionId = null
  ) {
    await request(
      questionId
        ? `/quizzes/${quizId}/questions/${questionId}`
        : `/quizzes/${quizId}/questions`,
      {
        method: questionId
          ? 'PUT'
          : 'POST',

        body: JSON.stringify(question),
      }
    )

    await loadCatalog()

    notify(
      questionId
        ? 'Question updated.'
        : 'Question created.'
    )
  }

  async function deleteQuestion(
    quizId,
    questionId
  ) {
    await request(
      `/quizzes/${quizId}/questions/${questionId}`,
      {
        method: 'DELETE',
      }
    )

    await loadCatalog()

    notify('Question deleted.')
  }

  async function changeUserRole(
    userId,
    role
  ) {
    const updated = await request(
      `/admin/users/${userId}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          role,
        }),
      }
    )

    setAdminUsers(users =>
      users.map(item =>
        item._id === userId
          ? {
              ...item,
              ...updated,
            }
          : item
      )
    )

    notify(
      `${updated.name}'s role updated.`
    )
  }

  const onStart = startQuiz

  let content

  if (
    !catalogReady &&
    routeName !== 'quiz' &&
    routeName !== 'result'
  ) {
    content = (
      <main className="page-width page-main">
        <LoadingState />
      </main>
    )
  } else if (
    routeName === 'login' ||
    routeName === 'register'
  ) {
    content = (
      <AuthPage
        mode={routeName}
        onModeChange={navigate}
        onSubmit={values =>
          submitAuth(
            values,
            routeName
          )
        }
        onGoogleAuth={submitGoogleAuth}
        onContinueDemo={
          continueDemo
        }
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  } else if (
    routeName === 'explore'
  ) {
    content = (
      <ExplorePage
        key={routeId || 'all'}
        quizzes={quizzes}
        categories={categories}
        onStart={onStart}
        initialCategory={
          routeId || 'all'
        }
      />
    )
  } else if (
    routeName === 'quiz'
  ) {
    content = !isAuthenticated ? (
      <AuthPage mode="login" onModeChange={navigate} onSubmit={values => submitAuth(values, 'login')} onGoogleAuth={submitGoogleAuth} onContinueDemo={continueDemo} theme={theme} onToggleTheme={toggleTheme} />
    ) : activeQuiz ? (
      <QuizPage
        key={activeQuiz._id}
        quiz={activeQuiz}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={() =>
          navigate('#explore')
        }
        onComplete={completeQuiz}
      />
    ) : quizLoadError ? (
      <main className="page-width page-main">
        <div className="access-denied">
          <AlertCircle size={22} />

          <h1>
            Quiz unavailable
          </h1>

          <p className="muted">
            {quizLoadError}
          </p>

          <button
            className="button button-primary"
            onClick={() =>
              navigate('#explore')
            }
          >
            Browse quizzes
          </button>
        </div>
      </main>
    ) : (
      <main className="page-width page-main">
        <LoadingState label="Preparing your quiz" />
      </main>
    )
  } else if (
    routeName === 'result'
  ) {
    content = (
      <ResultPage
        attempt={result}
        onTryAgain={() =>
          result?.quiz &&
          startQuiz(result.quiz)
        }
        onExplore={() =>
          navigate('#explore')
        }
        onDashboard={() =>
          navigate('#dashboard')
        }
      />
    )
  } else if (
    routeName === 'dashboard'
  ) {
    content = user ? (
      <DashboardPage
        user={user}
        data={
          dashboard ||
          localDashboard(user)
        }
        loading={loadingDashboard}
        onOpenAttempt={openAttempt}
        onExplore={() =>
          navigate('#explore')
        }
      />
    ) : (
      <AuthPage
        mode="login"
        onModeChange={navigate}
        onSubmit={values =>
          submitAuth(
            values,
            'login'
          )
        }
        onGoogleAuth={submitGoogleAuth}
        onContinueDemo={
          continueDemo
        }
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    )
  } else if (
    routeName === 'leaderboard'
  ) {
    content = (
      <LeaderboardPage
        categories={categories}
        category={leaderboardCategory}
        onCategoryChange={
          setLeaderboardCategory
        }
        entries={leaderboard}
        currentUser={user}
        isOffline={
          leaderboardOffline
        }
      />
    )
  } else if (
    routeName === 'coding'
  ) {
    content = !isAuthenticated ? (
      <LoadingState label="Opening login" />
    ) : (
      <AuthenticatedCoding user={user} playground={routeId === 'playground'} navigate={navigate} onExpired={() => {
        clearToken()
        localStorage.removeItem('quizly-user')
        setUser(null)
        pendingRouteRef.current = route
        navigate('#login')
      }} />
    )
  } else if (
    routeName === 'exams'
  ) {
    content = (
      <ExamsPage
        route={routeParts.slice(1)}
        user={user}
        navigate={navigate}
      />
    )
  } else if (
    routeName === 'admin'
  ) {
    content =
      user?.role === 'admin' &&
      adminVerified ? (
        routeId === 'exams' ? (
          <AdminExamsPage
            route={routeParts.slice(2)}
            navigate={navigate}
          />
        ) : routeId ===
          'questions' ? (
          <AdminQuestionsPage
            quizzes={quizzes}
            onLoadQuiz={
              loadFullQuiz
            }
            onSaveQuestion={
              saveQuestion
            }
            onDeleteQuestion={
              deleteQuestion
            }
            onNavigate={navigate}
          />
        ) : (
          <AdminPage
            activeSection={
              routeId || 'dashboard'
            }
            categories={categories}
            quizzes={quizzes}
            stats={adminStats}
            quizStats={
              adminQuizStats
            }
            users={adminUsers}
            loading={loadingAdmin}
            onSaveQuiz={saveQuiz}
            onDeleteQuiz={
              deleteQuiz
            }
            onSaveCategory={
              saveCategory
            }
            onDeleteCategory={
              deleteCategory
            }
            onLoadQuiz={
              loadFullQuiz
            }
            onChangeUserRole={
              changeUserRole
            }
          />
        )
      ) : user?.role ===
          'admin' &&
        adminCheckStatus ===
          'checking' ? (
        <main className="page-width page-main">
          <LoadingState label="Verifying administrator access" />
        </main>
      ) : (
        <main className="page-width page-main">
          <div className="access-denied">
            <AlertCircle size={22} />

            <h1>
              Admin access required
            </h1>

            <p className="muted">
              Sign in with an administrator
              account to open this workspace.
            </p>

            <button
              className="button button-primary"
              onClick={() =>
                navigate(
                  user
                    ? '#dashboard'
                    : '#login'
                )
              }
            >
              {user
                ? 'Return to dashboard'
                : 'Sign in'}{' '}
              <ArrowRightIcon />
            </button>
          </div>
        </main>
      )
  } else {
    content = (
      <HomePage
        categories={categories}
        quizzes={quizzes}
        stats={stats}
        user={user}
        onExplore={slug => navigate(exploreRoute(slug))}
        onStart={onStart}
        onRegister={() =>
          navigate(
            user
              ? '#dashboard'
              : '#register'
          )
        }
        onLeaderboard={() =>
          navigate('#leaderboard')
        }
      />
    )
  }

  const immersive =
    routeName === 'quiz' ||
    routeName === 'login' ||
    routeName === 'register'

  const isAdmin =
    user?.role === 'admin' &&
    adminVerified

  return (
    <div className="app-shell">
      {!immersive && (
        <Navbar
          user={user}
          isAdmin={isAdmin}
          theme={theme}
          onToggleTheme={toggleTheme}
          route={`#${routeName || 'home'}${
            routeId
              ? `/${routeId}`
              : ''
          }`}
          navigate={navigate}
          onLogout={signOut}
        />
      )}

      {catalogError &&
        routeName !== 'home' && (
          <div className="offline-banner page-width">
            <AlertCircle size={15} />{' '}
            {catalogError}
          </div>
        )}

      {content}

      <Toast
        message={toastMessage}
        onClose={() =>
          setToast('')
        }
      />
    </div>
  )
}

function ArrowRightIcon() {
  return (
    <BookOpenCheck size={15} />
  )
}
