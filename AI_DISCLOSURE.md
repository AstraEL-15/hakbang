# AI Disclosure

## Coding agent
- **Claude Code** (Anthropic), model **Claude Opus 5.5**, was the only AI coding agent. Copilot and other AI extensions were off.
- Commits made with the agent carry its `Co-Authored-By` trailer.

## What AI generated vs. what the team did
| AI (Claude Code) | Team |
|---|---|
| Wrote the app code (Next.js, API routes, prompts, scheduler, UI components) | Chose the idea, persona and problem framing (ADHD freeze, Bea) |
| Wrote the Firebase config, security rules and deploy commands | Decided scope and feature priorities, and approved the feature plan |
| Made the sample project brief (fictional school) | Set up the Firebase console (Blaze, auth providers, domains) |
| Ran automated browser checks and API checks | Tested on real devices, reviewed every diff, demo rehearsals |
| Drafted README, DEMO and this file | Pitch, design direction, final copy decisions |

## AI inside the product (via OpenRouter)
| Feature | Model | Input → output |
|---|---|---|
| Read the brief | `google/gemini-2.5-flash-lite` | Photo or text → deliverables, requirements, deadline (zod-validated JSON) |
| Plan steps | `google/gemini-2.5-flash-lite` | Brief + days + minutes/day + language → 10–18 steps with time and energy estimates |
| I'm stuck | `google/gemini-2.5-flash-lite` | Step + stuck reason + ladder rung → 2–4 smaller steps, encouragement, optional example |
| Fallback | `deepseek/deepseek-v4-flash-0731` | Used automatically if the first model fails or is rate-limited (text calls) |

**Not AI (our own code):** reverse-deadline scheduling, the PH holiday calendar, disruption rescheduling, pick-for-me, timers, the body-double room (Firebase Realtime DB) and voice transcription (browser Web Speech API).

## Feature log
- Golden path: photo → plan → one step → stuck → focus timer
- Google and guest sign-in, owner-only data
- Smarter Stuck (5 reasons, ladder, ugly draft, examples), Taglish
- Focus v2 (just 2 minutes, keep going?, parking lot, visual time)
- Reverse deadline + PH reality calendar + disruption auto-reschedule
- Body-doubling room (live presence + Kasama)
- Pick-for-me, voice start, energy-aware slots
