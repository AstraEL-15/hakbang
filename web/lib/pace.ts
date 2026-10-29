import { dayKey } from './schedule'
import type { Step } from './schemas'

const MIN_FOCUS_SEC = 20 // ignore accidental taps
const PRIOR_MIN = 5 // pulls the ratio toward 1× until there's real data, so one tiny step can't swing the plan

/**
 * Learned time padding: real focus time ÷ original estimate, over done steps that were timed.
 * Padding is safe, so it applies after 1 timed step; trimming risks overcommitting, so it waits for 3.
 */
export function learnedPace(steps: Step[]) {
  const timed = steps.filter((s) => s.status === 'done' && (s.focusSec ?? 0) >= MIN_FOCUS_SEC)
  const est = timed.reduce((a, s) => a + (s.est ?? s.minutes), 0)
  if (!timed.length || !est) return null
  const actual = timed.reduce((a, s) => a + (s.focusSec ?? 0) / 60, 0)
  const ratio = Math.round(Math.min(2, Math.max(0.8, (actual + PRIOR_MIN) / (est + PRIOR_MIN))) * 10) / 10
  return { ratio, samples: timed.length }
}

/** Should `next` replace the pace currently applied? */
export function paceChanged(next: { ratio: number; samples: number } | null, cur = 1) {
  if (!next || Math.abs(next.ratio - cur) < 0.15) return false
  return next.ratio > cur || next.samples >= 3
}

export const padded = (s: Step, pace: number): Step => {
  const est = s.est ?? s.minutes
  return { ...s, est, minutes: Math.max(1, Math.round(est * pace)) }
}

export const paceText = (r: number) =>
  r >= 1 ? `you run about ${r}× over my estimates` : `you finish about ${Math.round((1 - r) * 100)}% faster than I guessed`

/**
 * Show-ups, not streaks: the total never resets. Over the last 7 days, the first missed day
 * (after the student started) is a free skip 💤; other misses are neutral dots, never red.
 */
export function showUps(days: string[], today = new Date()) {
  const set = new Set(days)
  const t = dayKey(today)
  const first = [...set].sort()[0]
  let skip = false
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i)
    const key = dayKey(d)
    const label = d.toLocaleDateString('en-PH', { weekday: 'narrow' })
    let state: 'in' | 'today' | 'skip' | 'off' = 'off'
    if (set.has(key)) state = 'in'
    else if (key === t) state = 'today'
    else if (first && key > first && !skip) {
      skip = true
      state = 'skip'
    }
    return { key, label, state }
  })
  return { total: set.size, week, skipUsed: skip, today: set.has(t) }
}
