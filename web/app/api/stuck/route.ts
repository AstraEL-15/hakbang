import { aiJson, MODELS } from '@/lib/ai'
import { requireUser } from '@/lib/auth-server'
import { LANG_PROMPT } from '@/lib/lang'
import { type StuckReason, StuckRequest, StuckSchema } from '@/lib/schemas'

// Unstuck ladder: each rung caps micro-step size. Rung 3 is fixed: "just open the file".
const LADDER = [15, 5, 2]

const REASON: Record<StuckReason, { label: string; prompt: string }> = {
  confused: {
    label: 'Clarified a confusing step',
    prompt: `They DON'T UNDERSTAND what the step means. In "encouragement", explain the step in one plain sentence.
In "example", give a short example or fill-in-the-blank template skeleton of what the finished thing looks like (max 120 words, use line breaks).
Micro-steps start with looking at the example, then producing a first tiny piece.`,
  },
  too_big: {
    label: 'Shrank a step that felt too big',
    prompt: 'The step feels TOO BIG. Split it into smaller sequential pieces that together finish the step. "example" is "".',
  },
  boring: {
    label: 'Gamified a boring step',
    prompt: `The step is BORING. Turn it into a game: a beat-the-clock challenge, a count-up target, or a tiny reward after.
Keep the same work, make it playful. "example" is "".`,
  },
  scared: {
    label: 'Switched to ugly-first-draft mode',
    prompt: `They're SCARED it will be bad (perfectionism). Lower the bar: "ugly first draft" mode.
The micro-steps must ask for the WORST version ON PURPOSE (e.g. "Write the worst possible intro sentence, on purpose").
Say clearly that bad drafts are allowed and will be fixed later. "example" is "".`,
  },
  distracted: {
    label: 'Took a reset for distraction',
    prompt: `They're DISTRACTED. First micro-step is a 2-minute reset (drink water, put the phone face down, write the distracting thought down to park it).
Then 1–2 tiny re-entry steps back into the task. "example" is "".`,
  },
}

export async function POST(req: Request) {
  const uid = await requireUser(req)
  if (uid instanceof Response) return uid
  const parsed = StuckRequest.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const { projectTitle, step, lang, reason, level } = parsed.data

  // Bottom rung: no AI call, so it is instant and can't fail.
  if (level >= LADDER.length)
    return Response.json({
      data: {
        encouragement: lang === 'tl' ? 'Ito na lang muna. Promise, ito lang talaga.' : "Just this. Seriously, that's all.",
        example: '',
        microSteps: [{ title: lang === 'tl' ? "Buksan mo lang yung file. 'Yun lang." : "Just open the file. That's it.", minutes: 1 }],
      },
      meta: { model: 'ladder', ms: 0, tokensIn: 0, tokensOut: 0 },
      label: 'Reached the smallest step',
    })

  const cap = Math.max(1, Math.min(LADDER[level], Math.ceil(step.minutes / 2)))
  try {
    const { data, meta } = await aiJson({
      model: MODELS.parse, // fastest; aiJson falls back to the LLM
      name: 'stuck',
      schema: StuckSchema,
      system: `You help a college student with ADHD who is frozen on one step. Return 2–4 micro-steps.
Each micro-step is a concrete physical action of at most ${cap} minute${cap === 1 ? '' : 's'}, starting with a verb.
${REASON[reason].prompt}
No shame, no lectures, no guilt. ${LANG_PROMPT[lang]}`,
      content: `Project: ${projectTitle}\nStuck on: ${step.title} (${step.minutes} min)\nWhat done looks like: ${step.detail}`,
    })
    const microSteps = data.microSteps
      .filter((s) => s.title.trim())
      .slice(0, 4)
      .map((s) => ({ ...s, minutes: Math.round(Math.min(cap, Math.max(1, s.minutes || cap))) }))
    if (microSteps.length < 2) throw new Error('The AI could not split this step. Please try again.')
    const example = reason === 'confused' ? data.example.trim() : ''
    return Response.json({ data: { ...data, example, microSteps }, meta, label: REASON[reason].label })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not split that.' }, { status: 502 })
  }
}
