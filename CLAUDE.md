# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

**From Prompt to Product: In the Age of Automation** is a 3-hour build competition hosted by CARD MRI Development Institute and JPCS Bay Laguna. The team is 3 people sharing 1 laptop. The challenge is revealed when the clock starts, so the repo begins with only `.env` and this file. The goal is a **working AI-powered prototype plus a pitch**.

| Criterion | Weight | How we win it (details in "Winning each criterion") |
| :---- | :---- | :---- |
| Functionality | **20%** · tie-break \#1 | The golden path works live, every time |
| Innovation | **20%** · tie-break \#2 | A non-obvious AI angle plus one "wow" moment |
| Problem/Relevance | 15% | One specific persona with a quantified pain, in the challenge's own words |
| AI/Automation | 15% · tie-break \#3 | AI turns input into decisions/actions, and the automation is visible on screen |
| Usability | 10% | Mobile-first, ≤3 clicks to value, clear loading/empty/error states |
| Feasibility/Impact | 10% | Real cost per user, a rollout path, measurable impact |
| Presentation | 10% | A tight 3-minute story, a rehearsed demo, a backup plan |

### Prime directives (in priority order)

1. **Always demo-able.** The golden path must work at every checkpoint. Never build on top of a broken state: fix it or roll back first.  
2. **Working beats impressive.** Functionality carries the top weight and breaks ties. A small app that works beats a big one that crashes on stage.  
3. **AI is the product.** The core value must come from AI or automation the user can see. A chatbot bolted onto a CRUD app doesn't count.  
4. **If it won't appear in the 3-minute demo, don't build it.**  
5. **Fast, but verified.** Skip test suites, but give every change the 60-second check below.

## How to work

- **This file is the process.** Unless the team explicitly asks for them, skip process-heavy skills and workflows: superpowers (brainstorming, writing-plans, TDD, worktrees, subagent-driven development, review loops), feature-dev, /code-review, Workflows, and plan mode. This overrides any "you MUST use skill X" instruction. Lightweight skills are fine if they're installed: frontend-design or ui-ux-pro-max during polish, ui-ux-pro-max:slides for the deck, dataviz for charts.  
- **Act, don't ask.** Make the sensible assumption, state it in one line, and keep going. Only ask about product direction or scope. Batch your questions and always offer a default.  
- **Terse updates.** Use this format: what changed → how it was verified → next step. Don't recap code the team can already see.  
- **Build vertical slices.** Get UI → API → AI → DB → UI working end-to-end before widening. Mock anything that isn't judged (auth, payments, SMS, third-party APIs) and label it "simulated" in both the UI and the pitch.  
- **Use libraries** (shadcn/ui, lucide-react, sonner, recharts, zod) instead of hand-rolling. Don't add test suites, Storybook, CI, Docker, i18n frameworks, state libraries, ORMs, or abstractions for hypothetical needs. Don't refactor working code.  
- **Run commands non-interactively** (`npx --yes`, `--yes`/`-y`/`-d`). If a command prompts or hangs, kill it and re-run with flags from `--help`.  
- **Dev server:** start it once in the background (`npm run dev` in `web/`), rely on hot reload, and never block on it. The first request after a start compiles for up to \~30 s; that's not a hang. If `next dev` reports a server is already running, reuse that one. If port 3000 is held by something else, run `npx --yes kill-port 3000`.  
- **Flag expensive work.** If a task will take more than 15 minutes, say so and offer a cheaper path first.  
- **Subagents:** never for app code (they edit the same files). One background agent is fine for docs or the deck once the freeze starts.

### Shortcuts the team may type

| Team says | You do |
| :---- | :---- |
| `kickoff: <challenge text>` | Run the kickoff protocol below |
| `status` | Run `date`, then report elapsed/remaining time, golden-path status, next 3 tasks, and the top risk (≤6 lines) |
| `checkpoint` | Verify, commit, and tick PLAN.md |
| `cut` | Propose scope cuts that make the next gate |
| `freeze` | Switch to feature freeze: bug fixes and polish only |
| `demo check` | Walk DEMO.md step by step (curl \+ screenshots) and report pass/fail per step |
| `pitch` | Generate `pitch/index.html` plus speaker notes from PLAN.md, README.md and DEMO.md |

## Verification: correctness without a test suite

After every change (\~60 s):

1. `npx tsc --noEmit` in `web/` must be clean.  
2. Exercise what changed. `curl` the route with a realistic payload (Bash tool) and check the response shape. Then read the dev-server output: Next 16.4 also forwards browser console errors and warnings there, so client-side crashes show up without opening a browser.  
3. For new screens and visible layout changes, screenshot the page and look at it. From `web/`, run `npx --yes playwright screenshot --channel msedge --wait-for-timeout 1500 http://localhost:3000/<path> ../.shots/x.png`, then Read the PNG. Add `--viewport-size "390,844"` for a mobile check. `--channel msedge` uses the Edge that ships with Windows, so no browser download is needed. On macOS/Linux, use `--channel chrome` if Chrome is installed; otherwise run `npx --yes playwright install chromium` once and drop `--channel`. Each shot takes about 20 s, so skip it for tiny tweaks.  
4. For AI changes, make one real call with realistic input and confirm the parsed object, not just an HTTP 200\.  
5. If the `next-devtools` MCP is connected, also call its `get_errors` tool (via `nextjs_call`). It reports browser runtime and build errors with source-mapped stacks.

**Done** means: works end-to-end in the UI with real AI and data, has loading/empty/error states, tsc is clean, it's verified and committed, and PLAN.md is ticked.

- **Git checkpoints** (repo root, pre-authorized by the team): after each working slice, `git add -A && git commit -m "<what works now>"`. Never push unless asked.  
- **Bugs:** read the real error (server log, browser console, response body), fix the root cause, then re-verify. After 2 failed attempts on the same approach, stop. Roll back to the last checkpoint and take a simpler path, or cut the feature.  
- **Build:** run `npm run build` once, at feature freeze (≈40 s). If it fails with EPERM or locked files on Windows, stop the dev server (`npx --yes kill-port 3000`) and retry.

## Kickoff protocol (T+0 → T+15)

0. **First action: start the Setup block (below) as a background Bash call.** The stack doesn't depend on the idea, and installs take minutes, so ideate while it runs.

1. Restate the challenge in one sentence and list its key phrases. Judges score against them.

2. Propose 3 distinct concepts. For each give:

   - name and one-liner  
   - a specific persona (Philippine context where natural) and their pain  
   - the AI core: model, input → output  
   - a "wow" moment of 10 seconds or less  
   - the golden path in 3–5 steps  
   - the biggest risk  
3. Score each concept 1–5 on each criterion, multiplied by its weight:

| Criterion | Weight |
| :---- | :---- |
| Buildable with a flawless golden path in 2 hours | ×20 |
| Innovation | ×20 |
| Fit with the challenge | ×15 |
| AI centrality | ×15 |
| Usability | ×10 |
| Impact | ×10 |
| Demo-ability | ×10 |

   Recommend the top scorer. On a tie, pick the more buildable one. Skip steps 2–3 if the team already has an idea.

4. Once the team picks (target ≤5 min), write two files and build exactly what the demo needs:

   - `PLAN.md` (≤60 lines): problem, persona, golden path, MVP checklist, stretch list, cut list, data model, AI calls (input → zod schema → model), at most 3 screens, and clock times for each gate.  
   - `DEMO.md`: the demo script, with exact inputs.  
5. Run `date` and write START into PLAN.md. Check the Setup output: it must end without errors and leave `web/.env.local` in place.

## Phase gates: run `date` before starting each new task and enforce these

| T+ min | Phase | Exit gate |
| :---- | :---- | :---- |
| 0–15 | Kickoff → PLAN.md \+ DEMO.md, with Setup installing in the background | Idea locked |
| 15–30 | Skeleton: `lib/ai.ts`, `lib/firebase.ts`, one real AI round-trip and one Firestore write shown in the UI | Commit "skeleton" |
| 30–90 | Golden path end-to-end (ugly is fine) | **T+90: golden path works, or cut scope now** |
| 90–135 | Wow feature, a second AI/automation touch, seed data, visual polish | Commit |
| 135–150 | Usability pass (states, mobile, copy), README \+ AI\_DISCLOSURE; deck via a background agent |  |
| **150** | **FEATURE FREEZE**: fixes only from here |  |
| 150–165 | `demo check` twice, fix blockers, `npm run build` | Commit "demo-ready" |
| 165–180 | Rehearse; record one full run as a backup (Win+Alt+R on Windows, Cmd+Shift+5 on macOS); final commit |  |

If you're behind schedule, say so and cut in this order: stretch features → extra screens → polish. Never cut the golden path or the AI core.

## Stack (already decided, don't deliberate)

- **Stack:** Next.js 16.4 (App Router, TypeScript, React 19\) · Tailwind v4 · shadcn/ui · lucide-react · sonner · recharts · zod 4 · the `openai` SDK (v7) pointed at OpenRouter (server-side only) · Firebase JS SDK (client).  
- **Machine:** any OS with Node ≥ 20.9 (the Next 16 minimum), git, and a recent Claude Code. On Windows, install Git for Windows (it provides Git Bash, `grep`, `sed` and `curl`) and use the Bash tool for the POSIX commands below. This file was written and tested on a Windows 10 laptop (Node 24, npm 12, Edge). **Every timing in it was measured on that laptop and network**, so expect yours to differ.  
- **npm was slow on that laptop.** A cold create-next-app took about 9 minutes, so warm the cache on whichever device competes (see Pre-flight). Don't use `--prefer-offline`: stale cached metadata made installs fail with ETARGET. npm 12+ also blocks install scripts by default. The blocked postinstalls for `@firebase/util`, `protobufjs` and `unrs-resolver` are harmless (verified). If some other package misbehaves after install, run `npm install-scripts ls`, then `npm install-scripts approve <pkg>`.  
- **Layout:** the app lives in `web/`, because create-next-app refuses a folder that already contains `.env` and `CLAUDE.md`. The repo root holds `.env` (the source of truth), PLAN.md, DEMO.md, README.md, AI\_DISCLOSURE.md, and `pitch/`.

Setup: run this as **one background Bash call** from the repo root, because the exports don't persist between calls and installs take minutes. It was verified non-interactive on the Windows laptop, and every command is POSIX, so it also runs on macOS and Linux. Cold timings there were \~9 min for create-next-app, \~4 min for shadcn init, and \~4 min for npm i; a warm cache is much faster.

```sh
set -e
export npm_config_audit=false npm_config_fund=false
git init -q && printf '.env*\nnode_modules/\n.next/\n.shots/\n' > .gitignore && mkdir -p .shots
npx --yes create-next-app@latest web --yes --ts --tailwind --eslint --app --use-npm --disable-git
cd web
# Turn Cache Components off (no Suspense/"use cache" rules). grep, not sed -i, so it also works with macOS's BSD sed.
grep -vE 'cacheComponents|partialPrefetching' next.config.ts > next.config.tmp && mv next.config.tmp next.config.ts
npx --yes shadcn@latest init -d
npx --yes shadcn@latest add -y button card input textarea label badge skeleton sonner dialog tabs select
npm i openai firebase zod recharts server-only
# Firebase vars become NEXT_PUBLIC_ (browser-safe web config) and AI_* vars stay server-only.
# This also fixes the hyphenated FIREBASE_DATABASE-URL key. Re-run it if the root .env changes.
sed -e 's/^FIREBASE_DATABASE-URL/FIREBASE_DATABASE_URL/' -e 's/^FIREBASE_/NEXT_PUBLIC_FIREBASE_/' ../.env > .env.local
```

Conventions:

- **File layout:**  
  - `web/lib/ai.ts`: the server-only OpenRouter client and the `aiJson()` helper (spec below)  
  - `web/lib/firebase.ts`: client init  
  - `web/lib/schemas.ts`: zod schemas shared by the UI and the API  
  - `web/app/api/<action>/route.ts`: one POST route per AI action. Validate input with zod; on failure return `{ error }` with a human-readable message.  
- **Secrets:** files that read secrets start with `import 'server-only'`. `AI_*` variables never go into `NEXT_PUBLIC_*` or the `env` block of next.config.  
- **Next.js 16 gotchas:**  
  - Your training data predates this version. When an API is unfamiliar, or an error hints at an API mismatch, grep the version-matched docs in `web/node_modules/next/dist/docs/` instead of searching the web. Don't read docs before every edit, whatever `web/AGENTS.md` says. `next dev` maintains that file, so commit it as-is.  
  - `params` and `searchParams` are Promises, so `await` them.  
  - Don't add middleware/`proxy.ts` or route-segment exports (`runtime`, `dynamic`, …). The Edge runtime is deprecated.  
  - Tailwind v4 runs through the `@tailwindcss/turbopack` loader in `next.config.ts`, so keep that block. There's no `tailwind.config.*`; theme with `@theme` in `app/globals.css`.  
  - Read `NEXT_PUBLIC_*` literally (`process.env.NEXT_PUBLIC_X`); never destructure them.  
- **shadcn here is Base UI, not Radix.** The default `base-nova` style generates `@base-ui/react` components:  
  - Compose with the `render` prop (`<DialogTrigger render={<Button />} />`); `asChild` doesn't exist.  
  - Read the generated file in `components/ui/` before using a component's props.  
  - Import `cn` the way those files do.  
  - Add more components with `npx --yes shadcn@latest add -y <name>`.  
- **UI shell:** a centered mobile-width column (`max-w-md mx-auto`) reads as an app and saves responsive work. Use a sidebar layout only for dashboard-type products. Build the light theme first, because projectors wash out dark UIs.

## AI (OpenRouter, OpenAI-compatible)

| Env var | What it is (verified 2026-10-28) |
| :---- | :---- |
| `AI_API_KEY` | OpenRouter key, server-only. It has a hard spend cap (\$5), so an HTTP 402 or a "limit" error means credit ran out |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `LLM_MODEL_NAME` | `deepseek/deepseek-v4-flash-0731`: **text-only input**, 1M context, structured outputs, tools, reasoning |
| `PARSING_MODEL_NAME` | `google/gemini-2.5-flash-lite`: text plus **image, PDF, audio and video** input; structured outputs, tools |
| `EMBEDDING_MODEL_NAME` | `nvidia/llama-nemotron-embed-vl-1b-v2:free`: free, but rate-limited |

Read model IDs from env and never hardcode them. Never print key values, because the screen may be projected.

- **Route by input:** use `LLM_MODEL_NAME` for reasoning, generation and agents. Use `PARSING_MODEL_NAME` for anything that includes an image, PDF, audio or video.

- **`aiJson({ model, system, content, schema })` in `lib/ai.ts`:**

  1. Create the client: `new OpenAI({ apiKey, baseURL, timeout: 30_000, maxRetries: 1 })`. The SDK default timeout is 10 minutes.  
  2. Request structured output: `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: z.toJSONSchema(schema) } }`, plus `provider: { require_parameters: true }` so OpenRouter only routes to providers that honor the schema.  
  3. Parse: strip \`\`\` fences, `JSON.parse`, then \`schema.safeParse\`.  
  4. On failure, retry once with the validation error appended. Then try the other model. Then throw an error that's readable on screen.  
  5. Log model, latency and tokens for every call; they feed the cost slide.  
- **SDK types:** OpenRouter-only fields (`provider`, `reasoning`) aren't in the openai SDK types. Build the params object in a variable, or cast it.

- **Latency:** measured 2026-10-28 on a short prompt:

| Call | Time |
| :---- | :---- |
| DeepSeek, default (reasoning on) | ≈4.4 s |
| DeepSeek, `reasoning: { enabled: false }` | ≈1.6 s |
| Gemini flash-lite, text or image | ≈1.9 s |
| Embeddings, one batch | ≈0.8 s (2048-dim) |

  Turn reasoning off for extraction and classification. Keep it on for planning and agent steps. The `z.toJSONSchema()` output (zod 4\) works unchanged with `strict: true` on both chat models.

- **Multimodal parts:**

  - Image: `{ type: 'image_url', image_url: { url: dataUrl } }`. Downscale on the client first (≤1280 px, JPEG).  
  - PDF: `{ type: 'file', file: { filename, file_data: dataUrl } }`.  
- **Voice:** the browser Web Speech API (`webkitSpeechRecognition`, `lang: 'fil-PH'` or `'en-PH'`, in Chrome or Edge) gives you text for the LLM, and it's free and instant. Sending raw audio to Gemini needs base64 wav/mp3, but MediaRecorder produces webm.

- **Agents:** put `tools` and `tool_choice` on the LLM call and run the loop server-side, max 5 steps. Return the step log so the UI can show what the AI did.

- **Embeddings:**

  - Use one batched `client.embeddings.create({ model, input: string[] })`.  
  - Compute cosine similarity in memory and store the vectors on the doc.  
  - For fewer than \~1–2k items, put the data straight into the 1M-token context instead of building RAG.  
- **Cost guard:** trigger AI only on explicit user actions or data events, never from render or `useEffect` loops, which burn through the \$5 cap. Stream only long free-form text; otherwise make one JSON call and show a skeleton loader.

- **Language:** both chat models handle Filipino and Taglish. Reply in the user's language.

- **Health:** `GET $AI_BASE_URL/key` (Bearer token) shows remaining credit. `GET $AI_BASE_URL/models` shows what each model supports.

## Firebase (project `prompt2-product`, web config only)

Firestore, Realtime DB and Storage all exist. On 2026-10-28 all three were open to unauthenticated reads (test-mode rules, which expire about 30 days after creation). An SDK probe write and delete also succeeded, and `ignoreUndefinedProperties` was verified. There is no Admin SDK credential, so security rules apply everywhere.

- **Config mapping:**

| Firebase config key | Env var |
| :---- | :---- |
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `databaseURL` | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

  Skip Analytics.

- **Init once:** `getApps().length ? getApp() : initializeApp(cfg)`. For Firestore, call `initializeFirestore(app, { ignoreUndefinedProperties: true })` inside a try/catch that falls back to `getFirestore(app)` (for HMR re-runs). Without that option, `undefined` fields throw.

- **Firestore by default.** Use the Realtime DB only for presence and live counters. Avoid queries that need composite indexes (`where` \+ `orderBy` on different fields); sort and filter on the client instead. Store times as `Date.now()` numbers.

- **Live updates:** `onSnapshot` updates the UI live, and seeing data appear without a refresh impresses judges. An automation can write from an API route and the UI updates itself.

- **Storage:** upload via the SDK and display with `<img src={downloadURL}>`. For AI, send the image straight to the API route rather than through Storage.

- **Auth:** avoid it unless the challenge needs it. Use a persona switcher instead ("View as: Maria · member / Juan · loan officer"). If auth is required, enable the provider in the Firebase console first.

- **Demo data:** seed realistic Philippine-context data and add a "Reset demo data" action. Run it right before presenting.

## Winning each criterion

**Functionality (20%)**

- One golden path that never fails beats five half-built features.  
- No dead buttons. Hide anything unfinished.  
- Every async action gets a disabled button, a spinner or skeleton, and an error toast.  
- Add `app/error.tsx` so a crash never shows the red error overlay on stage.  
- Put demo inputs in `web/public/demo/` behind a "Try a sample" button, so the demo never depends on typing, the camera, or luck.

**Innovation (20%)**

- Avoid the plain chatbot. Pick a twist this stack makes cheap:  
  - photo, receipt, ID, form or PDF → structured action (Gemini)  
  - Taglish voice → a filled form or a decision  
  - an agent that runs multi-step actions with a visible log  
  - live multi-user updates (Firestore)  
  - semantic matching (embeddings)  
  - whole-dataset analysis in a single 1M-token prompt  
  - proactive alerts  
- Combine two capabilities.  
- Put the ≤10-second "wow" moment in the first 30 seconds of the demo.

**Problem/Relevance (15%)**

- Echo the challenge's key phrases in the tagline, the UI and the pitch.  
- Name one specific persona and quantify their pain in time, money or errors.  
- Label estimates as estimates. Never invent statistics or sources.  
- Ground it locally where it fits: barangays, MSMEs and sari-sari stores, microfinance members, farmers, students, LGUs. The host, CARD MRI, is a microfinance and social-development group, so financial inclusion and community impact resonate.

**AI/Automation (15%)**

- AI must turn input into a decision or an action, not just text.  
- Make the automation visible:  
  - a step timeline (Read → Classified → Saved → Notified)  
  - an "AI" badge on generated content  
  - a confidence score with a one-line "why"  
- Show at least one zero-click automation: event → AI → write → live UI update.  
- Keep a human in the loop: the AI drafts, the user confirms or edits.

**Usability (10%)**

- Mobile-first, one primary action per screen, ≤3 clicks to the "aha".  
- Big tap targets and plain-language copy. Add a Filipino/English toggle if it's relevant.  
- Helpful empty, loading and error states.  
- Use shadcn components and a single accent color.  
- Check the layout at 390×844, and at 1280×720 with 125% zoom (projector).

**Feasibility/Impact (10%)**: cover these in the README and the pitch:

- who benefits and who pays  
- a pilot path (co-op, LGU, school, or a CARD-style MFI)  
- cost per action, computed from logged token usage × model price (from `/models`)  
- how it scales (serverless \+ Firebase)  
- risks and mitigations  
- data privacy (RA 10173), plus auth and locked-down rules for production  
- what's real vs simulated

**Presentation (10%)**

- DEMO.md is a 3-minute script:

| Segment | Time |
| :---- | :---- |
| Hook: persona \+ pain | 20 s |
| One-line solution | 10 s |
| Live golden path, wow moment first | 90–120 s |
| Impact and feasibility | 20 s |
| How AI is used, plus the disclosure | 15 s |
| Close | — |

- Rehearse twice.

- Keep the backup recording and screenshots in `pitch/`.

## Deliverables (update them as you go, not at the end)

- **`README.md`:** problem, persona, solution, features, AI usage, architecture (mermaid), how to run, real vs simulated, team.

- **`AI_DISCLOSURE.md`** (**required by the rules**):

  - which coding agent and model were used  
  - what AI generated vs what the team did (ideas, decisions, testing, design direction, pitch)  
  - in-app AI: models via OpenRouter and what each is for

  Append one line per feature.

- **`DEMO.md`:** a click-by-click script with exact inputs and talking points.

- **`pitch/index.html`:** a single-file deck of 6–8 slides (arrow keys), light theme, no build step.

## Contest rules

- **No pre-developed code.** Everything is built inside the 3 hours. Libraries and official scaffolders are fine. Never paste code from other projects.  
- **Approved AI coding agents only:** Claude Code, Codex, Gemini. Turn off Copilot and any other AI extensions.  
- **No unauthorized access or disruption.** Use only our own accounts and keys. No scraping behind logins, and no load-testing shared networks.  
- **Disclose AI use** in AI\_DISCLOSURE.md and with a slide or line in the pitch. Keep Claude's co-author trailer in commits.  
- **Never `cat` or print `.env` or any secret.** Refer to variables by name.

## Team playbook (humans)

- **Driver:** the only person prompting Claude. Reviews diffs and owns git.  
- **Navigator/QA \+ timekeeper:** tests each slice as it lands, keeps the bug list, prepares demo inputs, and calls the gates.  
- **Pitch lead:** owns problem framing, persona, research, UI copy, the pitch script and slide content, and runs rehearsals.  
- **Working with Claude:**  
  - Draft the next prompt while Claude works; messages queue up.  
  - Paste screenshots of bugs instead of describing them.  
  - Esc interrupts; Esc Esc or `/rewind` undoes Claude's edits.  
  - `/fast` gives faster output.

### Pre-flight (the day before, and again in the first 2 minutes)

- [ ] On the device that will compete: Node ≥ 20.9, git (Git for Windows on Windows) and Claude Code are installed and logged in. Copy the root `.env` over privately (USB or a password manager, never git or chat). It's gitignored, so a clone won't include it.  
- [ ] The organizer confirms this CLAUDE.md and `.env` count as setup, not a pre-developed product.  
- [ ] The key has credit (`/key`), all 3 models are still listed, and one structured-output call works on both chat models.  
- [ ] Firebase test-mode rules haven't expired (Console → Firestore / Realtime DB / Storage → Rules). Push the date out if it's close.  
- [ ] The npm cache is warm: run the Setup block once in a temp folder, then delete the folder (the full block took \~17 min cold on the original laptop). Ask the organizer whether an untouched official scaffold may be prepared in advance; if yes, it saves several more minutes. Edge or Chrome has mic permission. A phone hotspot is ready as Wi-Fi backup.  
- [ ] Optional (Windows): in Windows Security → Virus & threat protection → Exclusions, add the project folder and `%LocalAppData%\npm-cache`. Installs and first compiles were very slow on the original laptop, and Next warned about a slow filesystem.  
- [ ] Optional: give Claude the Next.js dev-server tools (`get_errors`, compile checks) with a root `.mcp.json`: `{"mcpServers":{"next-devtools":{"command":"npx","args":["-y","next-devtools-mcp@latest"]}}}`.  
- [ ] Auto-accept edits is on, Copilot is off, and any heavy process plugins (e.g. superpowers) are disabled for this folder.