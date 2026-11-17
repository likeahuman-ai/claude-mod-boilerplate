// Draws one frame of the orbit into Raster cells: [codePoint, fg, bg] per cell.
import type { Agent, Live } from './live'
import { AMBER, CYAN, GREEN, LIME, hash, shortModel } from './live'

const DEFAULT = 0x01000000
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const DIM = 0x4a5568
const FAINT = 0x2d3440
const TEXT = 0xd8dee9
const MUTED = 0x8899aa

function scale(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k))
  const g = Math.min(255, Math.round(((color >> 8) & 255) * k))
  const b = Math.min(255, Math.round((color & 255) * k))
  return (r << 16) | (g << 8) | b
}

// Only width-1 characters: anything wide or outside the BMP becomes '?'.
function safe(code: number): number {
  if (code < 0x20 || code === 0x7f) return 0x20
  if (code > 0xffff) return 0x3f
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0xd800 && code <= 0xdfff)
  )
    return 0x3f
  return code
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function fit(text: string, width: number): string {
  if (width <= 0) return ''
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text.padEnd(width)
}

export function drawFrame(live: Live, columns: number, rows: number, now: number): string {
  const W = Math.max(1, columns)
  const H = Math.max(1, rows)
  const narrow = W < 80
  const cells = new Uint32Array(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    cells[i * 3] = 0x20
    cells[i * 3 + 1] = DEFAULT
    cells[i * 3 + 2] = DEFAULT
  }
  const put = (x: number, y: number, ch: string, fg: number) => {
    const cx = Math.round(x)
    const cy = Math.round(y)
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return
    const i = (cy * W + cx) * 3
    cells[i] = safe(ch.codePointAt(0) ?? 0x20)
    cells[i + 1] = fg
  }
  const write = (x: number, y: number, text: string, fg: number) => {
    let i = 0
    for (const ch of text) put(x + i++, y, ch, fg)
  }

  // The layout, top to bottom: sky, list.
  const loops = [live.main, ...live.agents]
  const tall = H >= 28
  const perLoop = narrow && tall ? 2 : 1
  const listRows = Math.min(loops.length * perLoop, Math.max(2, Math.floor(H / 3)))
  const skyH = Math.max(7, H - 1 - listRows)
  const top = 0
  const cx = W / 2
  const cy = top + skyH / 2
  const rx = Math.max(6, Math.min(W * 0.34, skyH * 1.5))
  const ry = Math.max(2, skyH * 0.34)

  // 2. The sky: stars that twinkle.
  for (let s = 0; s < Math.floor((W * skyH) / 50); s++) {
    const h = hash(`star${s}`)
    const glow = 0.5 + 0.5 * Math.sin(now / 900 + (h % 628) / 100)
    put(h % W, top + ((h >>> 12) % skyH), glow > 0.85 ? '+' : '·', scale(0x8899aa, 0.2 + 0.4 * glow))
  }

  // The orbit itself.
  for (let a = 0; a < 360; a += 5) {
    const t = (a * Math.PI) / 180
    put(cx + rx * Math.cos(t), cy + ry * Math.sin(t), '·', FAINT)
  }

  // Where each agent is now.
  const n = Math.max(3, live.agents.length)
  const where = (agent: Agent, at: number) => {
    const until = agent.endedAt ?? at
    const angle = (agent.slot * 2 * Math.PI) / n - Math.PI / 2 + ((until - agent.startedAt) / 1000) * 0.35
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
  }

  // Beams from the core to each running agent, with a dash that flows outward.
  for (const agent of live.agents) {
    if (agent.endedAt) continue
    const p = where(agent, now)
    const steps = Math.ceil(Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy) * 2))
    for (let k = 3; k < steps - 1; k++) {
      const lit = (((k - Math.floor(now / 90)) % 5) + 5) % 5 === 0
      put(cx + ((p.x - cx) * k) / steps, cy + ((p.y - cy) * k) / steps, lit ? '•' : '·', lit ? agent.color : scale(agent.color, 0.25))
    }
  }

  // Particles: a task flies out, a file flies in, an action reports back.
  live.particles = live.particles.filter(p => now - p.at < 1400)
  for (const particle of live.particles) {
    const agent = live.agents.find(a => a.id === particle.agentId)
    if (!agent) continue
    const t = Math.min(1, (now - particle.at) / 1100)
    const ease = 1 - (1 - t) * (1 - t)
    const target = where(agent, now)
    if (particle.kind === 'read') {
      const angle = ((particle.seed % 360) * Math.PI) / 180
      const sx = cx + rx * 1.4 * Math.cos(angle)
      const sy = Math.max(top, Math.min(top + skyH - 1, cy + ry * 1.4 * Math.sin(angle)))
      const x = sx + (target.x - sx) * ease
      const y = sy + (target.y - sy) * ease
      put(x - (target.x - sx) * 0.07, y - (target.y - sy) * 0.07, '·', scale(CYAN, 0.5))
      put(x, y, '◆', CYAN)
      if (t < 0.55) {
        const label = particle.label
        write(Math.max(0, Math.min(W - label.length, x - label.length / 2)), Math.max(top, y - 1), label, scale(CYAN, 1 - t))
      }
    } else {
      const from = particle.kind === 'spawn' ? { x: cx, y: cy } : target
      const to = particle.kind === 'spawn' ? target : { x: cx, y: cy }
      put(from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease, particle.kind === 'spawn' ? '★' : '◆', particle.kind === 'spawn' ? LIME : AMBER)
    }
  }

  // The core: the main session, pulsing, with its own context under it.
  const beat = 0.6 + 0.4 * Math.sin(now / 260)
  for (let a = 0; a < 360; a += 30) {
    const t = (a * Math.PI) / 180 + now / 1200
    put(cx + 3.2 * Math.cos(t), cy + 1.4 * Math.sin(t), '·', scale(LIME, 0.3 + 0.4 * beat))
  }
  put(cx, cy, '◉', scale(LIME, 0.55 + 0.45 * beat))
  write(cx - 2, cy + 2, 'MAIN', LIME)
  // 3. The agents: a trail and the name.
  for (const agent of live.agents) {
    const done = agent.endedAt !== undefined
    if (!done) {
      for (let k = 4; k >= 1; k--) {
        const p = where(agent, now - k * 160)
        put(p.x, p.y, '·', scale(agent.color, 0.7 - k * 0.14))
      }
    }
    const p = where(agent, now)
    const blink = done ? 1 : 0.65 + 0.35 * Math.sin(now / 180 + agent.slot)
    put(p.x, p.y, done ? '✔' : '●', done ? GREEN : scale(agent.color, blink))
    const name = fit(agent.name, narrow ? 12 : 18).trimEnd()
    // Labels go on the outer side, unless that side has no room for them.
    const right = p.x >= cx ? p.x + 2 + name.length <= W : p.x - 1 - name.length < 0
    const nx = right ? p.x + 2 : p.x - 1 - name.length
    write(nx, p.y, name, done ? scale(GREEN, 0.8) : agent.color)
  }

  let y = top + skyH

  // 6. The list: one live row per loop.
  const running = live.agents.filter(a => !a.endedAt).length
  const head = ` AGENTS ${running} running · ${live.agents.length - running} done `
  for (let x = 0; x < W; x++) put(x, y, '─', FAINT)
  write(1, y, head, LIME)
  y++

  const spin = SPIN[Math.floor(now / 80) % SPIN.length] ?? '·'
  for (const agent of loops) {
    if (y >= H) break
    const done = agent.endedAt !== undefined
    const last = agent.steps[agent.steps.length - 1]
    const lastText = last ? last.what : agent.task || 'starts…'
    put(1, y, done ? '✔' : spin, done ? GREEN : agent.color)
    if (!narrow) {
      write(3, y, fit(agent.name, 16), done ? DIM : TEXT)
      write(20, y, fit(shortModel(agent.model), 7), DIM)
      write(28, y, clock((agent.endedAt ?? now) - agent.startedAt), done ? DIM : AMBER)
      write(35, y, fit(`↓${agent.reads} ↑${agent.acts}`, 9), MUTED)
      write(45, y, fit(lastText, W - 46), done ? DIM : scale(agent.color, 0.9))
    } else if (tall) {
      write(3, y, fit(agent.name, 12), done ? DIM : TEXT)
      write(16, y, clock((agent.endedAt ?? now) - agent.startedAt), done ? DIM : AMBER)
      write(23, y, fit(`↓${agent.reads} ↑${agent.acts}`, W - 24), MUTED)
      if (y + 1 < H) {
        y++
        write(3, y, fit(lastText, W - 4), done ? DIM : scale(agent.color, 0.9))
      }
    } else {
      // A short, narrow pane: one row per loop, the last step after the timer.
      write(3, y, fit(agent.name, 11), done ? DIM : TEXT)
      write(15, y, clock((agent.endedAt ?? now) - agent.startedAt), done ? DIM : AMBER)
      write(21, y, fit(lastText, W - 22), done ? DIM : scale(agent.color, 0.9))
    }
    y++
  }

  return (new Uint8Array(cells.buffer) as unknown as { toBase64(): string }).toBase64()
}
