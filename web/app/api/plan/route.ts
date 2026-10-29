import { aiJson, MODELS } from '@/lib/ai'
import { requireUser } from '@/lib/auth-server'
import { PlanRequest, PlanSchema } from '@/lib/schemas'

const LANG = {
  en: 'Write every title and detail in simple, friendly English.',
  tl: 'Write every title and detail in casual Taglish (natural Filipino-English mix, like a supportive kuya/ate), e.g. "Buksan ang Google Docs at i-type ang title".',
}

const system = (lang: 'en' | 'tl') => `You are Hakbang, a planning coach for college students with ADHD who freeze when a task feels too big.
Break the task into small, concrete, sequential steps a student can start without thinking.
Rules:
- Step 1 MUST be absurdly easy and take 5 minutes or less (e.g. "Open a new Google Doc and type the title"). It must remove the fear of starting.
- Every title starts with a physical verb (Open, Write, List, Search, Copy, Read, Draft, Send...). No vague steps like "Research" or "Work on chapter 2".
- Every step after step 1 is 10–45 minutes. Group tiny actions together; the student can tap "I'm stuck" to shrink any step later.
- Cover every deliverable and requirement, in a sensible order, with a review/submit step at the end.
- detail is ONE short sentence (max 15 words) saying what done looks like.
- Return 10–16 steps total (never more than 18). Estimate time realistically for a student, not an expert.
- energy: low = mechanical, med = some focus, high = deep thinking/writing.
- ${LANG[lang]}`

export async function POST(req: Request) {
  const uid = await requireUser(req)
  if (uid instanceof Response) return uid
  const parsed = PlanRequest.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const { brief, deadline, minutesPerDay, lang } = parsed.data
  const daysLeft = Math.max(1, Math.ceil((deadline - Date.now()) / 86_400_000))
  try {
    const { data, meta } = await aiJson({
      model: MODELS.parse,
      system: system(lang),
      name: 'plan',
      schema: PlanSchema,
      content: `Task brief (JSON):\n${JSON.stringify(brief)}\n\nThe student has ${daysLeft} day(s) left and about ${minutesPerDay} minutes per day. Today is ${new Date().toDateString()}.`,
    })
    const steps = data.steps
      .filter((s) => s.title.trim())
      .map((s) => ({ ...s, minutes: Math.round(Math.min(45, Math.max(2, s.minutes || 10))) }))
    if (!steps.length) throw new Error('The AI returned no steps. Please try again.')
    return Response.json({ data: { ...data, steps }, meta })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not plan that.' }, { status: 502 })
  }
}
