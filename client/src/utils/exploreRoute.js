export function exploreRoute(subject) {
  return typeof subject === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subject)
    ? `#explore/${subject}`
    : '#explore'
}
