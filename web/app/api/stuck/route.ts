import { aiJson, MODELS } from '@/lib/ai'
import { StuckRequest, StuckSchema } from '@/lib/schemas'

const LANG = {
  en: 'Write in simple, warm English.',
  tl: 'Write in casual, warm Taglish (natural Filipino-English mix), e.g. "Buksan mo lang yung Google Scholar tab".',
}

export async function POST(req: Request) {
  const parsed = StuckRequest.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const { projectTitle, step, lang } = parsed.data
  try {
    const { data, meta } = await aiJson({
      model: MODELS.parse, // fastest; aiJson falls back to the LLM
      name: 'stuck',
      schema: StuckSchema,
      system: `You help a college student with ADHD who is frozen on one step. Split the step into 2–4 micro-steps.
Each micro-step is a tiny physical action of 1–3 minutes, so easy it feels silly (open a tab, type one sentence, copy one link).
The micro-steps together must complete the original step. No shame, no lectures. ${LANG[lang]}`,
      content: `Project: ${projectTitle}\nStuck on: ${step.title} (${step.minutes} min)\nWhat done looks like: ${step.detail}`,
    })
    const microSteps = data.microSteps
      .filter((s) => s.title.trim())
      .slice(0, 4)
      .map((s) => ({ ...s, minutes: Math.round(Math.min(5, Math.max(1, s.minutes || 2))) }))
    if (microSteps.length < 2) throw new Error('The AI could not split this step. Please try again.')
    return Response.json({ data: { ...data, microSteps }, meta })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not split that.' }, { status: 502 })
  }
}
