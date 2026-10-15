import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

document.documentElement.dataset.theme =
  localStorage.getItem('quizly-theme') === 'dark'
    ? 'dark'
    : 'light'
document.documentElement.dataset.fontSize =
  ['default', 'large', 'larger'].includes(localStorage.getItem('quizly-font-size'))
    ? localStorage.getItem('quizly-font-size')
    : 'default'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)