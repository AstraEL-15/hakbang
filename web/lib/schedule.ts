import type { Step } from './schemas'

export function dayKey(t: number | Date) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(key: string, today = new Date()) {
  const t = dayKey(today)
  const tm = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  if (key === t) return 'Today'
  if (key === tm) return 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Fit steps, in order, into daily blocks from today until the deadline day.
 * A step that doesn't fit today's remaining time moves to the next day (unless the day is still empty).
 * Anything past the deadline stays on the deadline day and is counted as overMinutes.
 */
export function schedule<T extends { minutes: number }>(steps: T[], deadline: number, minutesPerDay: number, from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const last = new Date(deadline)
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate())
  const days: string[] = []
  for (let d = new Date(start); d <= lastDay; d.setDate(d.getDate() + 1)) days.push(dayKey(d))
  if (!days.length) days.push(dayKey(start))

  let i = 0
  let used = 0
  let overMinutes = 0
  const out = steps.map((s) => {
    if (used > 0 && used + s.minutes > minutesPerDay && i < days.length - 1) {
      i++
      used = 0
    }
    used += s.minutes
    if (used > minutesPerDay && i === days.length - 1) overMinutes += Math.min(s.minutes, used - minutesPerDay)
    return { ...s, day: days[i] }
  })
  return { steps: out, daysUsed: new Set(out.map((s) => s.day)).size, overMinutes }
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export function totalMinutes(steps: Pick<Step, 'minutes'>[]) {
  return steps.reduce((a, s) => a + s.minutes, 0)
}
