const emailPattern = /^\S+@\S+\.\S+$/

export function authValidationError({ mode, name = '', identifier = '', password = '' }) {
  if (mode === 'register') {
    if (name.trim().length < 2) return 'Please enter your name (at least 2 characters).'
    if (!emailPattern.test(identifier.trim())) return 'Enter a valid email address.'
  } else if (identifier.trim().length < 3) {
    return 'Enter your email address or username.'
  }
  if (password.length < 8) return 'Use a password with at least 8 characters.'
  return null
}