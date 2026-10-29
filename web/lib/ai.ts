import 'server-only'
import OpenAI from 'openai'
import { z } from 'zod'
import type { AiMeta } from './schemas'

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
  timeout: 30_000,
  maxRetries: 1,
})

export const MODELS = {
  llm: process.env.LLM_MODEL_NAME!,
  parse: process.env.PARSING_MODEL_NAME!,
}

type Content = string | OpenAI.Chat.Completions.ChatCompletionContentPart[]
type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

function stripFences(s: string) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
}

function friendly(err: unknown): string {
  const status = (err as { status?: number })?.status
  const msg = err instanceof Error ? err.message : String(err)
  if (status === 402 || /limit|credit/i.test(msg)) return 'AI credit ran out. Please tell the team.'
  if (/timeout|timed out/i.test(msg)) return 'The AI took too long. Please try again.'
  return msg
}

/**
 * One structured-output call: strict JSON schema → parse → zod validate.
 * On failure: retry once with the validation error, then try the other model (text-only content), then throw.
 */
export async function aiJson<S extends z.ZodType>({
  model,
  system,
  content,
  schema,
  name = 'result',
  reasoning,
  timeoutMs = 20_000,
}: {
  model: string
  system: string
  content: Content
  schema: S
  name?: string
  reasoning?: boolean
  /** Per-attempt timeout; a stalled provider fails fast and the SDK retries once. */
  timeoutMs?: number
}): Promise<{ data: z.infer<S>; meta: AiMeta }> {
  const candidates = typeof content === 'string' ? [model, model === MODELS.llm ? MODELS.parse : MODELS.llm] : [model]
  const jsonSchema = z.toJSONSchema(schema)
  let lastErr = 'Unknown AI error'

  for (const m of candidates) {
    const messages: Message[] = [
      { role: 'system', content: system },
      { role: 'user', content } as Message,
    ]
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now()
      try {
        const params = {
          model: m,
          messages,
          response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: jsonSchema } },
          provider: { require_parameters: true },
          ...(reasoning !== undefined && m === MODELS.llm ? { reasoning: { enabled: reasoning } } : {}),
        }
        const res = await client.chat.completions.create(
          params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
          { timeout: timeoutMs },
        )
        const meta: AiMeta = {
          model: m,
          ms: Date.now() - t0,
          tokensIn: res.usage?.prompt_tokens ?? 0,
          tokensOut: res.usage?.completion_tokens ?? 0,
        }
        console.log(`[ai] ${name} ${m} ${meta.ms}ms in=${meta.tokensIn} out=${meta.tokensOut}`)
        const text = res.choices[0]?.message?.content ?? ''
        let parsed: unknown
        try {
          parsed = JSON.parse(stripFences(text))
        } catch {
          lastErr = 'AI returned invalid JSON'
          messages.push({ role: 'assistant', content: text }, { role: 'user', content: 'That was not valid JSON. Return only the corrected JSON object.' })
          continue
        }
        const result = schema.safeParse(parsed)
        if (result.success) return { data: result.data, meta }
        lastErr = z.prettifyError(result.error)
        messages.push(
          { role: 'assistant', content: text },
          { role: 'user', content: `Your JSON failed validation:\n${lastErr}\nReturn only the corrected JSON object.` },
        )
      } catch (err) {
        lastErr = friendly(err)
        console.error(`[ai] ${name} ${m} failed after ${Date.now() - t0}ms: ${lastErr}`)
        if (lastErr.startsWith('AI credit')) throw new Error(lastErr)
        break // API error: go to next model
      }
    }
  }
  throw new Error(`AI couldn't finish this one (${lastErr}). Please try again.`)
}
