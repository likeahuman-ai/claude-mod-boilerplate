/** One thing an agent did: a tool, and what it touched. */
export type Step = { tool: string; what: string; isRead: boolean }

/** One loop: the main session ("main") or a subagent. */
export type Agent = {
  id: string
  type: string
  task: string
  model: string
  isDone: boolean
  steps: Step[]
}

/** What the session read before its first word: instruction files and skills. */
export type Context = { files: string[]; blocks: string[]; skills: string[] }

declare module 'claude-code' {
  interface PluginState {
    'agent-watch': { agents: Shaped<Agent[]>; context: Shaped<Context> }
  }
}
