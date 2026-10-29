// Philippine reality calendar: days with less study time than usual.
// factor = share of the student's normal daily time that is realistic that day.
// Fixed-date holidays only; movable ones (Holy Week, Eid) and yearly special days need the official proclamation.
const HOLIDAYS: Record<string, { label: string; factor: number }> = {
  '11-01': { label: "All Saints' Day (Undas)", factor: 0.5 },
  '11-02': { label: "All Souls' Day (Undas)", factor: 0.5 },
  '11-30': { label: 'Bonifacio Day', factor: 0.75 },
  '12-08': { label: 'Immaculate Conception', factor: 0.75 },
  '12-24': { label: 'Christmas Eve', factor: 0.25 },
  '12-25': { label: 'Christmas Day', factor: 0 },
  '12-30': { label: 'Rizal Day', factor: 0.75 },
  '12-31': { label: "New Year's Eve", factor: 0.25 },
  '01-01': { label: "New Year's Day", factor: 0 },
}

export const phHoliday = (dayKey: string) => HOLIDAYS[dayKey.slice(5)]

export const DISRUPTIONS = {
  brownout: { emoji: '⚡', label: 'Brownout', factor: 0 },
  suspension: { emoji: '🌀', label: 'Typhoon / walang pasok', factor: 0 },
  commute: { emoji: '🚌', label: 'Long commute', factor: 0.5 },
  sick: { emoji: '🤒', label: 'Not feeling well', factor: 0 },
} as const
export type DisruptionKind = keyof typeof DISRUPTIONS
