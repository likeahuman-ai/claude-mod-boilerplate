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

/** One thing that happened, in plain words, for the caption and the ticker. */
export type Event = { text: string; color: number; at: number }

export type Live = {
  main: Agent
  agents: Agent[]
  particles: Particle[]
  events: Event[]
  files: string[]
  skills: string[]
}

export const MAIN = 'main'
export const LIME = 0xc6ff3d
export const CYAN = 0x5ee0ff
export const AMBER = 0xffc857
export const GREEN = 0x6dffa8

// One colour per agent, in order of spawn.
export const PALETTE = [0x5ee0ff, 0xff7ad9, 0xffc857, 0x9d8cff, 0x6dffa8, 0xff8f5e, 0x7ab8ff]

export function newLive(now: number): Live {
  return {
    main: blankAgent(MAIN, 'main session', now, -1, LIME),
    agents: [],
    particles: [],
    events: [],
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
