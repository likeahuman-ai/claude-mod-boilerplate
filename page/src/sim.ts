// A simulated agent run for the tutorial page.
// Each handler below makes the same updates as the hook of the same name in
// mods/agent-orbit/hooks/register.tsx, so the page draws what the mod draws.
import { drawSvg } from '../../mods/agent-orbit/hooks/desktop'
import { drawFrame } from '../../mods/agent-orbit/hooks/frame'
import type { Agent, Live, Step } from '../../mods/agent-orbit/hooks/live'
import { AMBER, CYAN, GREEN, LIME, MAIN, PALETTE, baseName, blankAgent, hash, newLive, say, shortModel, verbOf } from '../../mods/agent-orbit/hooks/live'

// Some browsers have no Uint8Array.prototype.toBase64 yet; frame.ts needs it.
const U8 = Uint8Array.prototype as unknown as { toBase64?: () => string }
if (typeof U8.toBase64 !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    configurable: true,
    writable: true,
    value: function (this: Uint8Array) {
      let s = ''
      for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(this.subarray(i, i + 0x8000)))
      return btoa(s)
    },
  })
}

const READS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Skill', 'LS'])
const ROOT = '/Users/you/practice-repo/'

export type ChatItem =
  | { kind: 'user'; text: string; at: number }
  | { kind: 'agent'; agentId: string; at: number }
  | { kind: 'plugin'; text: string; at: number }
  | { kind: 'claude'; text: string; at: number }

function whatOf(input: Record<string, unknown>, tool: string): string {
  const value = ['file_path', 'pattern', 'url', 'query', 'skill', 'command', 'description']
    .map(key => input[key])
    .find(v => typeof v === 'string')
  return String(value ?? tool)
}

export const PROMPT =
  'Use three Explore agents in parallel on the haiku model. One reads PROBLEMS.md, one reads SUGGESTIONS.md, one reads PARKING.md. Each returns the top 3 themes, one line each. Do not change any file.'

export const DEBRIEF = [
  'Explore 1 read the most (3 files) and found speed and browser bugs: a slow login on a phone, an export that fails in Safari.',
  'Explore 2 found one theme in SUGGESTIONS.md: trust in the data. Show the last sync time in the header.',
  'Explore 3 found look and feel in PARKING.md: a dark theme for the dashboard and a bigger font.',
]

export const LENGTH = 23 // seconds, then the run starts again

export class Run {
  live: Live
  chat: ChatItem[] = []
  t0: number
  talkBack: boolean
  private reported = new Set<string>()
  private idx = 0
  private timeline: { at: number; run: () => void }[]

  constructor(talkBack: boolean, now = Date.now()) {
    this.t0 = now
    this.talkBack = talkBack
    this.live = newLive(now)
    const ids = ['a7f3c1', 'b29e04', 'c5d8a2']
    const read = (id: string | undefined, file: string) => () => this.toolCall(id, 'Read', { file_path: ROOT + file })
    const bash = (id: string | undefined, command: string) => () => this.toolCall(id, 'Bash', { command })
    this.timeline = [
      { at: 0.4, run: () => this.promptSubmit() },
      { at: 1.0, run: () => this.promptContext([{ kind: 'project', path: `${ROOT}CLAUDE.md` }, { kind: 'user', path: '/Users/you/.claude/CLAUDE.md' }]) },
      { at: 1.7, run: () => this.toolCall(undefined, 'Glob', { pattern: '*.md' }) },
      { at: 2.3, run: () => this.agentSpawn(ids[0]!, 'Explore', 'Themes in PROBLEMS.md') },
      { at: 2.7, run: () => this.agentSpawn(ids[1]!, 'Explore', 'Themes in SUGGESTIONS.md') },
      { at: 3.1, run: () => this.agentSpawn(ids[2]!, 'Explore', 'Themes in PARKING.md') },
      { at: 3.8, run: read(ids[0], 'PROBLEMS.md') },
      { at: 4.4, run: read(ids[1], 'SUGGESTIONS.md') },
      { at: 5.0, run: read(ids[2], 'PARKING.md') },
      { at: 5.9, run: read(ids[0], 'CLAUDE.md') },
      { at: 6.6, run: bash(ids[2], 'grep -c "^- " PARKING.md') },
      { at: 7.3, run: read(ids[1], 'PROBLEMS.md') },
      { at: 8.0, run: bash(ids[0], 'wc -l PROBLEMS.md') },
      { at: 8.8, run: read(ids[2], 'SUGGESTIONS.md') },
      { at: 9.7, run: () => this.turnComplete(ids[1]!) },
      { at: 10.4, run: read(ids[0], 'FLOW.md') },
      { at: 11.4, run: bash(ids[2], 'wc -l PARKING.md') },
      { at: 12.2, run: () => this.turnComplete(ids[0]!) },
      { at: 14.0, run: () => this.turnComplete(ids[2]!) },
      { at: 16.2, run: () => this.claudeAnswers() },
    ]
  }

  /** Runs every timeline entry that is due. Returns true when the model changed. */
  tick(now = Date.now()): boolean {
    const s = (now - this.t0) / 1000
    let changed = false
    while (this.idx < this.timeline.length && this.timeline[this.idx]!.at <= s) {
      this.timeline[this.idx]!.run()
      this.idx++
      changed = true
    }
    // frame.ts drops old particles itself; this keeps the list short when no frame is drawn.
    this.live.particles = this.live.particles.filter(p => now - p.at < 2000)
    return changed
  }

  elapsed(now = Date.now()): number {
    return (now - this.t0) / 1000
  }

  busy(): boolean {
    return this.live.agents.some(a => a.endedAt === undefined)
  }

  private loopOf(id: string | undefined): Agent {
    const live = this.live
    if (!id) return live.main
    let agent = live.agents.find(a => a.id === id)
    if (!agent) {
      const slot = live.agents.length
      agent = blankAgent(id, 'agent', Date.now(), slot, PALETTE[slot % PALETTE.length] ?? CYAN)
      agent.name = `Agent ${slot + 1}`
      live.agents.push(agent)
    }
    return agent
  }

  // prompt.submit
  private promptSubmit() {
    say(this.live, 'You give Main a task', LIME, Date.now())
    this.chat.push({ kind: 'user', text: PROMPT, at: Date.now() })
  }

  // prompt.context
  private promptContext(instructionFiles: { kind: string; path: string }[]) {
    const live = this.live
    live.files = instructionFiles.map(file => `${file.kind}: ${baseName(file.path)}`)
    if (live.files.length > 0) say(live, `Main loads ${live.files.length} instruction files (CLAUDE.md)`, CYAN, Date.now())
  }

  // agent.spawn, after `await next(e)` returned the agentId and the model
  private agentSpawn(agentId: string, subagentType: string, description: string) {
    const live = this.live
    const started = { agentId, model: 'claude-haiku-4-5' }
    const agent = this.loopOf(started.agentId)
    const same = live.agents.filter(a => a.type === subagentType).length + 1
    agent.type = subagentType
    agent.name = `${subagentType} ${same}`
    agent.task = description
    agent.model = shortModel(started.model)
    agent.startedAt = Date.now()
    live.particles.push({ kind: 'spawn', agentId: agent.id, label: '', seed: 0, at: Date.now() })
    say(live, `Main hands ${agent.name} a task: "${description}" (${agent.model})`, LIME, Date.now())
    this.chat.push({ kind: 'agent', agentId: agent.id, at: Date.now() })
  }

  // tool.call
  private toolCall(agentId: string | undefined, tool: string, input: Record<string, unknown>) {
    const live = this.live
    const agent = this.loopOf(agentId)
    const what = whatOf(input, tool)
    const step: Step = { tool, what: verbOf(tool, what), isRead: READS.has(tool), at: Date.now() }
    agent.steps = [...agent.steps, step].slice(-30)
    if (step.isRead) {
      agent.reads++
      const file = baseName(what)
      agent.context = [...agent.context.filter(f => f !== file), file].slice(-4)
    } else agent.acts++
    say(live, `${agent.name} ${step.what}`, step.isRead ? CYAN : AMBER, Date.now())
    if (agent.id !== MAIN) {
      live.particles.push({
        kind: step.isRead ? 'read' : 'act',
        agentId: agent.id,
        label: baseName(what),
        seed: hash(what),
        at: Date.now(),
      })
    }
  }

  // turn.complete
  private turnComplete(agentId: string) {
    const live = this.live
    const agent = live.agents.find(a => a.id === agentId)
    if (agent && agent.endedAt === undefined) {
      agent.endedAt = Date.now()
      const s = Math.round((agent.endedAt - agent.startedAt) / 1000)
      say(live, `${agent.name} is done after ${s}s: read ${agent.reads}, did ${agent.acts}`, GREEN, Date.now())
    }
    if (!this.talkBack) return

    // Step 5: the mod talks back, once per wave.
    const wave = live.agents.filter(a => !this.reported.has(a.id))
    if (wave.length > 0 && wave.every(a => a.endedAt !== undefined)) {
      wave.forEach(a => this.reported.add(a.id))
      const lines = wave.map(
        a => `- ${a.name} (${a.model}), ${Math.round(((a.endedAt ?? 0) - a.startedAt) / 1000)}s, read ${a.reads}, did ${a.acts}: ${a.task}`,
      )
      say(live, 'The mod sends a debrief prompt to the chat', LIME, Date.now())
      const text = [
        `Agent orbit saw ${wave.length} agent(s) finish:`,
        ...lines,
        'Give a debrief in at most 4 lines: which agent read the most, and the one finding of each agent.',
      ].join('\n')
      this.chat.push({ kind: 'plugin', text, at: Date.now() })
    }
  }

  private claudeAnswers() {
    if (this.talkBack) this.chat.push({ kind: 'claude', text: DEBRIEF.join('\n'), at: Date.now() })
    else
      this.chat.push({
        kind: 'claude',
        text: 'The three agents are done. Top themes: speed and browser bugs, trust in the data, look and feel.',
        at: Date.now(),
      })
  }
}

/** A copy of the model without the explain layer (no events, no context), for step 3. */
export function bare(live: Live): Live {
  return {
    ...live,
    events: [],
    files: [],
    main: { ...live.main, context: [] },
    agents: live.agents.map(a => ({ ...a, context: [] })),
  }
}

/** One frame from frame.ts, decoded from base64 into [codePoint, fg, bg] per cell. */
export function frameCells(live: Live, columns: number, rows: number, now: number): Uint32Array {
  const b64 = drawFrame(live, columns, rows, now)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Uint32Array(bytes.buffer)
}

declare global {
  interface Window {
    Orbit: unknown
  }
}

window.Orbit = { Run, bare, frameCells, drawSvg, drawFrame, LENGTH, PROMPT, DEBRIEF, LIME, CYAN, AMBER, GREEN }
