import { aiJson, MODELS } from '@/lib/ai'
import { requireUser } from '@/lib/auth-server'
import { createHash } from 'node:crypto'
import { type AiMeta, type Brief, BriefSchema, ReadRequest } from '@/lib/schemas'

const SYSTEM = `You read school assignments, project briefs and syllabi (photos, screenshots or pasted text).
Extract what the student must produce. Be faithful: never invent requirements that are not there.
List each deliverable separately (chapters, sections, presentations, forms). Keep items short.
If the text is in Filipino or Taglish, keep it in that language.`

// Same photo/text → same brief. Keeps the demo sample instant after its first read.
const cache = new Map<string, { data: Brief; meta: AiMeta }>()

export async function POST(req: Request) {
  const uid = await requireUser(req)
  if (uid instanceof Response) return uid
  const parsed = ReadRequest.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const { text, image } = parsed.data
  const key = createHash('sha256').update(`${image ?? ''}|${text ?? ''}`).digest('hex')
  const hit = cache.get(key)
  if (hit) return Response.json({ data: hit.data, meta: { ...hit.meta, ms: 0 }, cached: true })
  try {
    const { data, meta } = image
      ? await aiJson({
          model: MODELS.parse,
          system: SYSTEM,
          name: 'brief',
          schema: BriefSchema,
          timeoutMs: 12_000,
          content: [
            { type: 'text', text: `Read this task.${text?.trim() ? `\nExtra notes from the student: ${text}` : ''}` },
            { type: 'image_url', image_url: { url: image } },
          ],
        })
      : await aiJson({ model: MODELS.parse, system: SYSTEM, name: 'brief', schema: BriefSchema, timeoutMs: 12_000, content: `Read this task:\n\n${text}` })
    if (cache.size > 200) cache.clear()
    cache.set(key, { data, meta })
    return Response.json({ data, meta })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not read that.' }, { status: 502 })
  }
}
