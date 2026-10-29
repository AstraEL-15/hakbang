import { aiJson, MODELS } from '@/lib/ai'
import { BriefSchema, ReadRequest } from '@/lib/schemas'

const SYSTEM = `You read school assignments, project briefs and syllabi (photos, screenshots or pasted text).
Extract what the student must produce. Be faithful: never invent requirements that are not there.
List each deliverable separately (chapters, sections, presentations, forms). Keep items short.
If the text is in Filipino or Taglish, keep it in that language.`

export async function POST(req: Request) {
  const parsed = ReadRequest.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  const { text, image } = parsed.data
  try {
    const { data, meta } = image
      ? await aiJson({
          model: MODELS.parse,
          system: SYSTEM,
          name: 'brief',
          schema: BriefSchema,
          content: [
            { type: 'text', text: `Read this task.${text?.trim() ? `\nExtra notes from the student: ${text}` : ''}` },
            { type: 'image_url', image_url: { url: image } },
          ],
        })
      : await aiJson({ model: MODELS.parse, system: SYSTEM, name: 'brief', schema: BriefSchema, content: `Read this task:\n\n${text}` })
    return Response.json({ data, meta })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Could not read that.' }, { status: 502 })
  }
}
