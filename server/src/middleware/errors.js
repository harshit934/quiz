export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body')) {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' })
  }
  if (error.name === 'ZodError') {
    return res.status(400).json({ message: 'Please check the submitted information.', errors: error.issues })
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message })
  }
  if (error.name === 'CastError') {
    return res.status(404).json({ message: 'The requested record was not found.' })
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists.' })
  }

  console.error(error)
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Something went wrong.' })
}