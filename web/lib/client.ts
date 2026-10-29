// Browser helpers shared by screens.
import { auth } from './firebase'

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No connection. Check the Wi-Fi and try again.')
  }
  const json = await res.json().catch(() => ({ error: 'Unexpected server response.' }))
  if (!res.ok || json.error) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}

/** Downscale an image to a JPEG data URL (long side ≤ max px): keeps uploads small but text legible. */
export async function toDataUrl(blob: Blob, max = 1600): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("Couldn't open that image. Try a JPG or PNG."))
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const LAST = 'hakbang:last'
export const lastProject = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem(LAST) ?? 'null') as { id: string; title: string } | null
    } catch {
      return null
    }
  },
  set: (v: { id: string; title: string } | null) => {
    try {
      if (v) localStorage.setItem(LAST, JSON.stringify(v))
      else localStorage.removeItem(LAST)
    } catch {}
  },
}
