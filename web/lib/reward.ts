import confetti from 'canvas-confetti'

const MUTE_KEY = 'hakbang:mute'

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
  } catch {}
}

let ctx: AudioContext | null = null

/** Two-note rising chime, synthesized (no audio files). */
function chime() {
  if (isMuted()) return
  try {
    ctx ??= new AudioContext()
    const t0 = ctx.currentTime
    ;[659.25, 987.77].forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = t0 + i * 0.09
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  } catch {}
}

const COLORS = ['#14b8a6', '#2dd4bf', '#fbbf24', '#f472b6', '#60a5fa']

/** Immediate feedback on every finished step: confetti + chime + a tiny buzz. `big` for the last step. */
export function reward(big = false) {
  chime()
  try {
    navigator.vibrate?.(big ? [30, 40, 60] : 30)
  } catch {}
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 100 }
  confetti({ ...base, particleCount: big ? 160 : 70, spread: big ? 100 : 70, startVelocity: big ? 45 : 35, origin: { y: 0.65 } })
  if (big)
    setTimeout(() => {
      confetti({ ...base, particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
      confetti({ ...base, particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
    }, 250)
}

export const CHEERS = {
  en: ['Nice! One step down. 🎉', 'Look at you go! ✨', "That's a real step. 💪", 'Done is better than perfect. 🎉', 'Momentum! Keep it rolling. 🚀'],
  tl: ['Ayan! Isang hakbang na. 🎉', 'Galing! Tuloy lang. ✨', 'Kaya mo pala eh! 💪', 'Tapos na yan. Next! 🚀', 'Isa-isa lang, panalo na. 🎉'],
} as const
