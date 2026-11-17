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
}

export type Live = {
  main: Agent
  agents: Agent[]
  files: string[]
  skills: string[]
}

export const MAIN = 'main'
export const LIME = 0xc6ff3d
export const CYAN = 0x5ee0ff

// One colour per agent, in order of spawn.
export const PALETTE = [0x5ee0ff, 0xff7ad9, 0xffc857, 0x9d8cff, 0x6dffa8, 0xff8f5e, 0x7ab8ff]

export function newLive(now: number): Live {
  return {
    main: blankAgent(MAIN, 'main session', now, -1, LIME),
    agents: [],
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
  }
}

export function shortModel(model: string): string {
  const m = /(opus|sonnet|haiku|fable)/i.exec(model)
  return m?.[1] ? m[1].toLowerCase() : model.slice(0, 8)
}

export function baseName(text: string): string {
  return text.split('/').pop()?.slice(0, 22) ?? text
}
