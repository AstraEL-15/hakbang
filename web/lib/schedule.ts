import { phHoliday } from './ph-calendar'
import type { Step } from './schemas'

export function dayKey(t: number | Date) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const startOfDay = (t: number | Date) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dayLabel(key: string, today = new Date()) {
  const t = dayKey(today)
  const tm = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  if (key === t) return 'Today'
  if (key === tm) return 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Opts = {
  from?: Date
  /** dayKey → share of normal time available (disruptions). */
  blocked?: Record<string, number>
  /** Reverse planning: finish this many hours before the deadline. */
  bufferHours?: number
}

export const BUFFER_HOURS = 24

/**
 * Reverse deadline planning: work backward from (deadline − buffer), fitting steps, in order, into each day's
 * realistic capacity (normal time × PH holiday factor × disruption factor). Days with no capacity are skipped.
 * A step that doesn't fit today's remaining time moves to the next day; anything past the last day counts as overMinutes.
 */
export function schedule<T extends { minutes: number }>(steps: T[], deadline: number, minutesPerDay: number, opts: Opts = {}) {
  const start = startOfDay(opts.from ?? new Date())
  let last = startOfDay(deadline - (opts.bufferHours ?? BUFFER_HOURS) * 3_600_000)
  if (last < start) last = startOfDay(deadline) < start ? start : startOfDay(deadline)

  const days: { key: string; cap: number }[] = []
  for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d)
    const factor = Math.min(phHoliday(key)?.factor ?? 1, opts.blocked?.[key] ?? 1)
    days.push({ key, cap: Math.round(minutesPerDay * factor) })
  }
  let open = days.filter((d) => d.cap > 0)
  if (!open.length) open = [{ key: days[days.length - 1].key, cap: 0 }]

  let i = 0
  let used = 0
  let overMinutes = 0
  const out = steps.map((s) => {
    // 10% soft cap: a step may run a little over instead of leaving a gap and pushing everything back.
    if (used > 0 && used + s.minutes > open[i].cap * 1.1 && i < open.length - 1) {
      i++
      used = 0
    }
    used += s.minutes
    if (i === open.length - 1 && used > open[i].cap * 1.1) overMinutes += Math.min(s.minutes, Math.round(used - open[i].cap * 1.1))
    return { ...s, day: open[i].key }
  })
  return {
    steps: out,
    daysUsed: new Set(out.map((s) => s.day)).size,
    overMinutes,
    finishDay: out.length ? out[out.length - 1].day : dayKey(start),
    holidays: days.map((d) => d.key).filter((k) => phHoliday(k)), // inside the planning window
  }
}

/** No-guilt progress check: todo steps planned for days that already passed. */
export function planStatus(steps: Step[], today = new Date()) {
  const t = dayKey(today)
  const todo = steps.filter((s) => s.status === 'todo')
  return {
    behind: todo.filter((s) => s.day < t).length,
    finishDay: todo.length ? todo.reduce((a, s) => (s.day > a ? s.day : a), todo[0].day) : null,
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export function totalMinutes(steps: Pick<Step, 'minutes'>[]) {
  return steps.reduce((a, s) => a + s.minutes, 0)
}

/** Energy-aware slots: hard steps go in the student's peak focus time, easy ones fill low-energy time. */
export const PEAK = {
  morning: { emoji: '🌅', label: 'Morning' },
  afternoon: { emoji: '☀️', label: 'Afternoon' },
  night: { emoji: '🌙', label: 'Night' },
} as const
export type Peak = keyof typeof PEAK
export const isDeep = (s: Pick<Step, 'energy'>) => s.energy !== 'low'
