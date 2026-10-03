export function isQuizQuestionMigrationModeEnabled(environment = process.env) {
  return environment.QUIZ_QUESTION_MIGRATION_MODE === 'enabled'
}

export function shouldSeedStarterContent(environment = process.env) {
  return !isQuizQuestionMigrationModeEnabled(environment)
}
