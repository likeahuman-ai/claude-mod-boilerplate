// The live model: what the animation draws. Plain module state, filled by the hooks.

export type Step = { tool: string; what: string; isRead: boolean; at: number }

export type Agent = {
  id: string
  type: string
  name: string
  task: string
  model: string
  startedAt: number
  endedAt?: number
  slot: number
  color: number
  steps: Step[]
  reads: number
  acts: number
  /** The files this agent read: its context, shown as satellites around it. */
  context: string[]
}

export type Particle = {
  kind: 'spawn' | 'read' | 'act'
  agentId: string
  label: string
  seed: number
  at: number
}

/** One message of the chat, mirrored to the live page. */
export type ChatLine = { role: 'you' | 'plugin' | 'claude'; text: string; at: number }

/** One thing that happened, in plain words, for the caption and the ticker. */
export type Event = { text: string; color: number; at: number }

export type Live = {
  main: Agent
  agents: Agent[]
  particles: Particle[]
  events: Event[]
  chat: ChatLine[]
  files: string[]
  skills: string[]
}

export const MAIN = 'main'
// Like A Human tokens, dark mode: lime is the scarce accent, the rest are the state inks.
export const LIME = 0xdefeb3
export const CYAN = 0xa3d2ff
export const AMBER = 0xe4c57e
export const GREEN = 0x7fc79a

// One colour per agent, in order of spawn.
export const PALETTE = [0x8fbce4, 0xe88f8f, 0xd4a64a, 0xc7d4e2, 0x7fc79a, 0xa3d2ff, 0xe4c57e]

export function newLive(now: number): Live {
  return {
    main: blankAgent(MAIN, 'main session', now, -1, LIME),
    agents: [],
    particles: [],
    events: [],
    chat: [],
    files: [],
    skills: [],
  }
}

export function blankAgent(id: string, type: string, now: number, slot: number, color: number): Agent {
  return {
    id,
    type,
    name: id === MAIN ? 'Main' : type,
    task: '',
    model: '',
    startedAt: now,
    slot,
    color,
    steps: [],
    reads: 0,
    acts: 0,
    context: [],
  }
}

export function say(live: Live, text: string, color: number, at: number): void {
  live.events = [...live.events, { text, color, at }].slice(-20)
}

export function addChat(live: Live, role: ChatLine['role'], text: string, at: number): void {
  live.chat = [...live.chat, { role, text: text.slice(0, 1200), at }].slice(-12)
}

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function shortModel(model: string): string {
  const m = /(opus|sonnet|haiku|fable)/i.exec(model)
  return m?.[1] ? m[1].toLowerCase() : model.slice(0, 8)
}

export function baseName(text: string): string {
  return text.split('/').pop()?.slice(0, 22) ?? text
}

/** A tool call in plain words: "reads frame.ts", "searches for TODO". */
export function verbOf(tool: string, what: string): string {
  const name = baseName(what)
  switch (tool) {
    case 'Read':
      return `reads ${name}`
    case 'Grep':
      return `searches for "${what.slice(0, 24)}"`
    case 'Glob':
      return `looks for files ${what.slice(0, 24)}`
    case 'LS':
      return `lists ${name}`
    case 'WebFetch':
    case 'WebSearch':
      return `reads the web: ${what.slice(0, 28)}`
    case 'Skill':
      return `loads the skill ${what}`
    case 'Edit':
    case 'Write':
      return `edits ${name}`
    case 'Bash':
      return `runs ${what.slice(0, 28)}`
    case 'Agent':
      return `starts an agent: ${what.slice(0, 28)}`
    default:
      return `uses ${tool}`
  }
}
