import { z } from 'zod'

// AI output schemas: every field required (strict structured outputs); ranges are clamped in code.
export const BriefSchema = z.object({
  title: z.string().describe('Short name of the task/project'),
  course: z.string().describe('Course or context, empty string if none'),
  deadlineText: z.string().describe('Deadline exactly as written, empty string if none'),
  deliverables: z.array(z.string()).describe('Each thing that must be produced or submitted'),
  requirements: z.array(z.string()).describe('Format rules, minimums, grading criteria'),
  rawText: z.string().describe('Key facts not captured above, max 60 words'),
})
export type Brief = z.infer<typeof BriefSchema>

export const PlanSchema = z.object({
  title: z.string(),
  summary: z.string().describe('One calm sentence describing the whole task'),
  steps: z.array(
    z.object({
      title: z.string().describe('Concrete physical action starting with a verb'),
      detail: z.string().describe('Max 15 words: what done looks like'),
      minutes: z.number().describe('Realistic minutes, 2 to 45'),
      energy: z.enum(['low', 'med', 'high']),
    }),
  ),
})
export type Plan = z.infer<typeof PlanSchema>

export const StuckSchema = z.object({
  encouragement: z.string().describe('One short, warm, non-judgmental sentence'),
  example: z.string().describe('Short example or template skeleton when asked for one, otherwise empty string'),
  microSteps: z.array(
    z.object({
      title: z.string().describe('Tiny physical action, almost too easy'),
      minutes: z.number().describe('1 to 3'),
    }),
  ),
})
export type Stuck = z.infer<typeof StuckSchema>

// API inputs
export const Lang = z.enum(['en', 'tl'])
export type Lang = z.infer<typeof Lang>

export const ReadRequest = z
  .object({
    text: z.string().max(60_000).optional(),
    image: z.string().startsWith('data:').optional(),
  })
  .refine((v) => v.text?.trim() || v.image, { message: 'Add a photo or paste the task first.' })

export const PlanRequest = z.object({
  brief: BriefSchema,
  deadline: z.number(),
  minutesPerDay: z.number().min(10).max(600),
  lang: Lang,
})

export const StuckReason = z.enum(['confused', 'too_big', 'boring', 'scared', 'distracted'])
export type StuckReason = z.infer<typeof StuckReason>

export const StuckRequest = z.object({
  projectTitle: z.string(),
  step: z.object({ title: z.string(), detail: z.string(), minutes: z.number() }),
  lang: Lang,
  reason: StuckReason.default('too_big'),
  level: z.number().int().min(0).default(0),
})

// Stored in Firestore
export type Step = {
  id: string
  title: string
  detail: string
  minutes: number
  energy: 'low' | 'med' | 'high'
  status: 'todo' | 'done'
  day: string // YYYY-MM-DD
  parentId?: string
  level?: number // unstuck-ladder rung: 0 = original step
  example?: string // template shown for "I don't get it"
  focusSec?: number
}

export type LogEntry = { label: string; detail: string; ms: number; model?: string }

export type Project = {
  id: string
  ownerId: string
  title: string
  summary: string
  deadline: number
  minutesPerDay: number
  lang: Lang
  createdAt: number
  steps: Step[]
  log: LogEntry[]
  overMinutes: number
}

export type AiMeta = { model: string; ms: number; tokensIn: number; tokensOut: number }
