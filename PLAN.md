# Hakbang — one overwhelming task → one doable next step

START: 13:39 (Thu 2026-10-29) · skeleton 14:09 · golden path 15:09 · freeze 16:09 · demo-ready 16:24 · end 16:39

## Problem & persona
**Bea, 20, 3rd-year BS Psych student in Laguna, diagnosed ADHD.** She gets a 10-page research brief and
freezes. She knows it's due in 9 days, but she can't tell where to *start*, so she starts nothing until the
night before. Pain: lost days of paralysis, cramming, late penalties (we'll describe these in her words and label any numbers as estimates).
Existing breakdown tools (e.g. goblin.tools) need typed input and give no schedule. **Our edge: photo in → steps
with time estimates → fitted into real blocks before the deadline → ONE step on screen → "Stuck" shrinks it. EN/Taglish.**

## Golden path (≤3 taps to value)
1. Home → **Try a sample brief** (or snap/upload a photo / paste text). The deadline is pre-filled, and so is minutes/day.
2. **Hakbang na!** → visible AI pipeline: Read brief → Found deliverables → Broke into N steps → Scheduled across D days → Saved.
3. Plan screen shows ONE giant card: "Step 1: Open a doc and write the title — 5 min" + **Start focus** (timer).
4. **Stuck?** → AI splits the current step into 2–4 micro-steps (≤3 min each), live.
5. **Done** → the next step slides in; progress + "Your schedule" (day blocks) below.

## MVP checklist
- [x] Setup + `lib/ai.ts` (aiJson) + `lib/firebase.ts` + `lib/schemas.ts`
- [x] `/api/read` + `/api/plan` (Gemini Flash Lite primary, DeepSeek fallback) → client schedules → Firestore
- [x] Deterministic scheduler (`lib/schedule.ts`): fit steps into daily blocks, flag "at risk" if they don't fit
- [x] Plan screen `/p/[id]`: onSnapshot, one-step card, Done, progress, schedule list, pipeline log
- [x] `/api/stuck` → micro-steps replace the current step in Firestore
- [x] Focus timer (dialog, countdown = step minutes)
- [ ] EN / Taglish toggle (AI output language)
- [ ] Sample brief image in `web/public/demo/`, error.tsx, loading/empty/error states

## Stretch (only after T+90 green)
- Deadline-risk alert ("Hindi kasya — 3h over. Cut these optional steps?")
- Voice "brain dump" input (Web Speech, fil-PH)
- Confetti / streak on Done

## Cut list (not building)
Auth (persona = device), notifications/calendar sync (simulated label only), multiple projects dashboard, editing steps by hand.

## Data model (Firestore)
`projects/{id}`: { title, summary, deadline:number, minutesPerDay, lang:'en'|'tl', createdAt,
  steps: Step[], log: {label, detail, ms}[] }
`Step`: { id, title, detail, minutes, energy:'low'|'med'|'high', status:'todo'|'done', day:'YYYY-MM-DD', parentId? }

## AI calls
1. **Read** (`PARSING_MODEL_NAME`, only if image/PDF): image → `Brief {title, course?, deadlineText?, deliverables[], requirements[], rawText}`
2. **Plan** (`LLM_MODEL_NAME`, reasoning on): Brief + deadline + minPerDay + lang →
   `Plan {title, summary, steps[{title, detail, minutes(2–45), energy}]}`. Step 1 MUST be tiny (≤5 min, zero-thinking).
3. **Stuck** (`LLM_MODEL_NAME`, reasoning off): step + project title + lang → `{encouragement, microSteps[{title, minutes(1–3)}]}`

## Screens
1. `/` Capture · 2. `/p/[id]` Next step + schedule · (focus timer = dialog)
