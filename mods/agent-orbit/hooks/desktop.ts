// The desktop view: one animated SVG, drawn again on each change.
// Every animation starts at a negative offset (its phase at `now`), so a redraw
// continues the motion instead of starting it over.
import type { Agent, Live } from './live'
import { AMBER, CYAN, GREEN, LIME, shortModel } from './live'

const VW = 760
const VH = 540
const CX = 400
const CY = 228
const RX = 235
const RY = 140

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// The phase of a repeating animation at `now`, as a negative SMIL begin.
function phase(now: number, ms: number, shift = 0): string {
  return `-${((now + shift) % ms) / 1000}s`
}

function spot(agent: Agent, count: number) {
  const n = Math.max(3, count)
  const angle = (agent.slot * 2 * Math.PI) / n - Math.PI / 2 + 0.35
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle), angle }
}

export function drawSvg(live: Live, now: number): string {
  const out: string[] = []
  const running = live.agents.filter(a => a.endedAt === undefined).length
  const done = live.agents.length - running

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" font-family="Montserrat, 'Space Grotesk', ui-sans-serif, sans-serif">`)
  out.push(`<defs>
    <radialGradient id="sky" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#15294A"/><stop offset="0.6" stop-color="#0F1F38"/><stop offset="1" stop-color="#08142A"/></radialGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF8E7"/><stop offset="0.45" stop-color="${hex(LIME)}"/><stop offset="1" stop-color="${hex(LIME)}" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <style>
    .label { fill: #EAF1F8; font-size: 13px; font-weight: 700; }
    .sub { fill: #9FB3C8; font-size: 11px; font-family: 'Space Grotesk', Montserrat, sans-serif; }
    .chip { fill: #C7D4E2; font-size: 10.5px; font-family: 'Space Mono', ui-monospace, Menlo, monospace; }
    .agent:hover .halo { opacity: 0.55; }
    .agent { cursor: default; }
  </style>`)

  // The sky: a deep gradient with twinkling stars.
  out.push(`<rect x="0" y="0" width="${VW}" height="${VH}" rx="18" fill="url(#sky)"/>`)
  for (let s = 0; s < 70; s++) {
    const h = Math.imul(s + 1, 2654435761) >>> 0
    const x = h % VW
    const y = (h >>> 11) % 400
    const r = 0.5 + ((h >>> 5) % 10) / 10
    const dur = 2400 + (h % 3000)
    out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#C7D4E2"><animate attributeName="opacity" values="0.1;0.8;0.1" dur="${dur}ms" begin="${phase(now, dur, h % 1000)}" repeatCount="indefinite"/></circle>`)
  }

  // The legend and the header.
  const legend: [string, string][] = [
    [hex(LIME), 'main session'],
    ['#E88F8F', 'agent'],
    [hex(CYAN), 'reads a file'],
    [hex(AMBER), 'acts'],
    [hex(GREEN), 'done'],
  ]
  let lx = 22
  for (const [color, label] of legend) {
    out.push(`<circle cx="${lx}" cy="24" r="4.5" fill="${color}" filter="url(#glow)"/><text x="${lx + 10}" y="28" class="sub">${label}</text>`)
    lx += 22 + label.length * 6.2
  }
  out.push(`<text x="${VW - 22}" y="28" text-anchor="end" class="sub"><tspan fill="${hex(LIME)}" font-weight="700">${running}</tspan> running · <tspan fill="${hex(GREEN)}" font-weight="700">${done}</tspan> done · ${live.files.length || live.main.context.length} context files</text>`)

  // The orbit: a slow, flowing dashed ring.
  out.push(`<ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}" fill="none" stroke="#1F3D66" stroke-width="1.2" stroke-dasharray="2 7"><animate attributeName="stroke-dashoffset" from="0" to="-90" dur="6s" begin="${phase(now, 6000)}" repeatCount="indefinite"/></ellipse>`)

  // The chat: where the person types, and where the mod talks back.
  const chat = { x: 70, y: CY }
  const lastIn = [...live.events].reverse().find(e => e.text.startsWith('You give Main'))
  const lastOut = [...live.events].reverse().find(e => e.text.startsWith('The mod sends'))
  out.push(`<g><title>The chat: you give Main a task here, and the mod sends its debrief here.</title>
    <rect x="${chat.x - 46}" y="${chat.y - 22}" width="92" height="44" rx="12" fill="#0F1F38" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <text x="${chat.x}" y="${chat.y - 2}" text-anchor="middle" class="label">CHAT</text>
    <text x="${chat.x}" y="${chat.y + 13}" text-anchor="middle" class="sub">you + Claude</text></g>`)
  out.push(`<path id="chatline" d="M ${chat.x + 46} ${chat.y} L ${CX - 30} ${CY}" stroke="#1F3D66" stroke-width="1" stroke-dasharray="3 5" fill="none"/>`)
  for (const [event, color, reverse] of [[lastIn, LIME, false], [lastOut, LIME, true]] as const) {
    if (!event || now - event.at > 2200) continue
    const path = reverse ? `M ${CX - 30} ${CY} L ${chat.x + 46} ${chat.y}` : `M ${chat.x + 46} ${chat.y} L ${CX - 30} ${CY}`
    out.push(`<circle r="6" fill="${hex(color)}" filter="url(#glow)" opacity="0"><animateMotion path="${path}" dur="1.4s" begin="-${(now - event.at) / 1000}s" fill="freeze"/><animate attributeName="opacity" values="0;1;1;0" dur="1.4s" begin="-${(now - event.at) / 1000}s" fill="freeze"/></circle>`)
  }

  // Beams from the core to each agent: flowing while it runs, faint when it is done.
  for (const agent of live.agents) {
    const p = spot(agent, live.agents.length)
    const isDone = agent.endedAt !== undefined
    const c = hex(isDone ? GREEN : agent.color)
    out.push(`<line x1="${CX}" y1="${CY}" x2="${p.x}" y2="${p.y}" stroke="${c}" stroke-opacity="${isDone ? 0.18 : 0.55}" stroke-width="${isDone ? 1 : 1.6}" stroke-dasharray="${isDone ? '0' : '4 10'}">${isDone ? '' : `<animate attributeName="stroke-dashoffset" from="0" to="-28" dur="0.9s" begin="${phase(now, 900)}" repeatCount="indefinite"/>`}</line>`)
  }

  // The core: the main session, with rings that pulse outward.
  for (let k = 0; k < 3; k++) {
    out.push(`<circle cx="${CX}" cy="${CY}" r="26" fill="none" stroke="${hex(LIME)}" stroke-width="1.5"><animate attributeName="r" values="26;62" dur="2.4s" begin="${phase(now, 2400, k * 800)}" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="2.4s" begin="${phase(now, 2400, k * 800)}" repeatCount="indefinite"/></circle>`)
  }
  const mainCtx = (live.files.length > 0 ? live.files : live.main.context).slice(0, 3)
  out.push(`<g><title>Main session. Context it carries: ${esc(mainCtx.join(', ') || 'none seen yet')}. Reads ${live.main.reads}, actions ${live.main.acts}.</title>
    <circle cx="${CX}" cy="${CY}" r="34" fill="url(#core)" opacity="0.55" filter="url(#soft)"/>
    <circle cx="${CX}" cy="${CY}" r="20" fill="${hex(LIME)}" filter="url(#glow)"><animate attributeName="r" values="19;22;19" dur="1.6s" begin="${phase(now, 1600)}" repeatCount="indefinite"/></circle>
    <text x="${CX}" y="${CY + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1C2B3A">MAIN</text></g>`)
  mainCtx.forEach((file, i) => {
    out.push(`<text x="${CX}" y="${CY + 54 + i * 14}" text-anchor="middle" class="chip" fill-opacity="0.7">◇ ${esc(cut(file, 26))}</text>`)
  })

  // Particles: a task flies out, a file flies in, an action reports back.
  for (const particle of live.particles.filter(p => now - p.at < 1600)) {
    const agent = live.agents.find(a => a.id === particle.agentId)
    if (!agent) continue
    const p = spot(agent, live.agents.length)
    const ago = `-${(now - particle.at) / 1000}s`
    let path: string
    let color: number
    if (particle.kind === 'read') {
      const a = ((particle.seed % 360) * Math.PI) / 180
      path = `M ${CX + RX * 1.6 * Math.cos(a)} ${CY + RY * 1.6 * Math.sin(a)} L ${p.x} ${p.y}`
      color = CYAN
    } else if (particle.kind === 'spawn') {
      path = `M ${CX} ${CY} L ${p.x} ${p.y}`
      color = LIME
    } else {
      path = `M ${p.x} ${p.y} L ${CX} ${CY}`
      color = AMBER
    }
    out.push(`<g opacity="0"><animateMotion path="${path}" dur="1.2s" begin="${ago}" fill="freeze"/><animate attributeName="opacity" values="0;1;1;0" dur="1.2s" begin="${ago}" fill="freeze"/>
      <rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" fill="${hex(color)}" filter="url(#glow)"/>
      ${particle.kind === 'read' ? `<text y="-12" text-anchor="middle" class="chip" fill="${hex(CYAN)}">${esc(cut(particle.label, 22))}</text>` : ''}</g>`)
  }

  // The agents: a glowing node, a spinning ring while it runs, its files as chips.
  for (const agent of live.agents) {
    const p = spot(agent, live.agents.length)
    const isDone = agent.endedAt !== undefined
    const c = hex(isDone ? GREEN : agent.color)
    const secs = Math.round(((agent.endedAt ?? now) - agent.startedAt) / 1000)
    const last = agent.steps.slice(-4).map(s => s.what).join(' · ')
    const below = p.y >= CY - 10
    const files = agent.context.slice(-3)
    // Below the core the text hangs under the node; above it, it stacks upward.
    const ty = below ? p.y + 34 : p.y - 34 - files.length * 13
    out.push(`<g class="agent"><title>${esc(agent.name)} (${esc(shortModel(agent.model))})
Task: ${esc(agent.task || '–')}
Read ${agent.reads} · acted ${agent.acts} · ${secs}s
Context: ${esc(agent.context.join(', ') || 'none yet')}
Last: ${esc(last || '–')}</title>
      <circle class="halo" cx="${p.x}" cy="${p.y}" r="30" fill="${c}" opacity="0.18" filter="url(#soft)"/>
      ${isDone ? '' : `<circle cx="${p.x}" cy="${p.y}" r="21" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="22 110" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 ${p.x} ${p.y}" to="360 ${p.x} ${p.y}" dur="1.1s" begin="${phase(now, 1100, agent.slot * 300)}" repeatCount="indefinite"/></circle>`}
      <circle cx="${p.x}" cy="${p.y}" r="13" fill="${c}" filter="url(#glow)">${isDone ? '' : `<animate attributeName="opacity" values="0.75;1;0.75" dur="1.3s" begin="${phase(now, 1300, agent.slot * 400)}" repeatCount="indefinite"/>`}</circle>
      ${isDone ? `<path d="M ${p.x - 5} ${p.y} l 3.5 4 l 7 -8" stroke="#1C2B3A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      <text x="${p.x}" y="${ty}" text-anchor="middle" class="label">${esc(cut(agent.name, 18))}</text>
      <text x="${p.x}" y="${ty + 15}" text-anchor="middle" class="sub">${esc(shortModel(agent.model))} · ${isDone ? `done in ${secs}s` : `${agent.reads} reads · ${agent.acts} acts`}</text>`)
    files.forEach((file, i) => {
      out.push(`<text x="${p.x}" y="${ty + 31 + i * 13}" text-anchor="middle" class="chip" fill="${c}" fill-opacity="${isDone ? 0.5 : 0.85}">◇ ${esc(cut(file, 24))}</text>`)
    })
    out.push(`</g>`)
  }

  // The caption bar: the newest event typed out, and the two before it.
  out.push(`<rect x="16" y="${VH - 104}" width="${VW - 32}" height="88" rx="12" fill="#0F1F38" stroke="#FFFFFF" stroke-opacity="0.12"/>`)
  const newest = live.events[live.events.length - 1]
  if (newest) {
    const fresh = Math.max(0, now - newest.at)
    const text = cut(newest.text, 90)
    const typed = Math.min(1, fresh / (text.length * 18))
    out.push(`<clipPath id="type"><rect x="40" y="${VH - 94}" height="28" width="${typed * 680}"><animate attributeName="width" to="680" dur="${Math.max(0.01, (1 - typed) * text.length * 0.018)}s" fill="freeze"/></rect></clipPath>`)
    out.push(`<circle cx="30" cy="${VH - 79}" r="5" fill="${hex(newest.color)}" filter="url(#glow)"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></circle>`)
    out.push(`<text x="42" y="${VH - 74}" font-size="15" font-weight="700" fill="#EAF1F8" clip-path="url(#type)">${esc(text)}</text>`)
  } else {
    out.push(`<text x="30" y="${VH - 74}" font-size="14" fill="#9FB3C8">Waiting for a prompt. Give Claude a task with agents.</text>`)
  }
  live.events
    .slice(-3, -1)
    .reverse()
    .forEach((event, i) => {
      const s = Math.max(0, Math.round((now - event.at) / 1000))
      out.push(`<text x="42" y="${VH - 50 + i * 18}" font-size="12" fill="${hex(event.color)}" fill-opacity="${0.75 - i * 0.25}"><tspan fill="#9FB3C8" fill-opacity="0.7" font-family="Space Mono, monospace">${s}s ago  </tspan>${esc(cut(event.text, 96))}</text>`)
    })

  out.push(`</svg>`)
  return out.join('\n')
}
