export const codingMinutes = { Easy: 15, Medium: 30, Hard: 45 }
export function timedChallenge(challenge, now = Date.now()) {
  return { ...challenge, deadline: Number.isFinite(challenge.deadline) ? challenge.deadline : now + (codingMinutes[challenge.difficulty] || 15) * 60000 }
}
export function remainingSeconds(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
export function clockLabel(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
