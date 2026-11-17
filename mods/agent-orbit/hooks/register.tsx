import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { drawSvg } from './desktop'
import { drawFrame } from './frame'
import type { Agent, Step } from './live'
import { AMBER, CYAN, GREEN, LIME, MAIN, PALETTE, addChat, baseName, blankAgent, hash, newLive, say, shortModel, verbOf } from './live'

const PANE = 'agent-orbit'
const RASTER = 'orbit'
const READS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Skill', 'LS'])

// A counter for the text view on surfaces without a Raster.
const version = atom({ plugin: 'agent-orbit', key: 'version' } as const, 0)
// This chat's id on the live page. Kept in the session's state, so a reload of the mod keeps it.
const sessionId = atom({ plugin: 'agent-orbit', key: 'sessionId' } as const, '')

// The live model and the size of the mounted Raster. Both start over on a reload.
const live = newLive(Date.now())
let size: { columns: number; rows: number } | undefined
// True once a desktop pane drew the SVG view, and when it last redrew.
let vectorShown = false
let lastRedraw = 0
// Agents whose end the mod already reported to the chat.
const reported = new Set<string>()

function whatOf(input: Record<string, unknown>, tool: string): string {
  const value = ['file_path', 'pattern', 'url', 'query', 'skill', 'command', 'description']
    .map(key => input[key])
    .find(v => typeof v === 'string')
  return String(value ?? tool)
}

function loopOf(id: string | undefined): Agent {
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

// The live web page, like the build board. The mod posts its model to a small
// bridge (bridge/serve.ts) about 3 times a second while agents run; the bridge streams
// it to every open page, so the page and the pane draw the same model. The bridge
// answers each post with the prompts the page queued, and the mod sends them to Claude.
const BRIDGE = 'http://127.0.0.1:4747'
let lastSent = 0
let bridgeDownUntil = 0
// Who this chat is on the page: the page shows one chip per session, and a button
// sends its prompt to the session that is selected there.
const session = { id: crypto.randomUUID(), label: 'Claude Code', surface: 'terminal' as string }

function mirror($: EngineInterface, now: number): void {
  const busy = live.agents.some(a => a.endedAt === undefined) || now - (live.events[live.events.length - 1]?.at ?? 0) < 3000
  if (now < bridgeDownUntil || now - lastSent < (busy ? 300 : 3000)) return
  lastSent = now
  void $.http
    .fetch(`${BRIDGE}/state`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...live, sentAt: now, session }) })
    .then(async r => {
      if (!r.ok) {
        bridgeDownUntil = now + 5000
        return
      }
      // A prompt from the page goes into the chat as if the person typed it.
      const { prompts } = JSON.parse(r.text) as { prompts?: string[] }
      for (const text of prompts ?? []) {
        say(live, 'The web page sends a prompt to the chat', LIME, Date.now())
        $.ui.toast('The orbit page sent a prompt to Claude')
        await $.prompt.submit({ text, asUser: true })
      }
    })
    .catch(() => {
      bridgeDownUntil = now + 5000
    })
}

// Starts the bridge when it does not answer (detached, so it outlives the turn), like /board.
async function ensureBridge($: EngineInterface): Promise<boolean> {
  const up = async () => (await $.http.fetch(`${BRIDGE}/health`).catch(() => ({ ok: false }))).ok
  if (await up()) return true
  // The mod sits in <repo>/mods/agent-orbit; the bridge in <repo>/bridge.
  const start = `cd "${$.plugin.root}" && { [ -d .claude-plugin ] || cd ..; } && cd ../.. && nohup bun bridge/serve.ts > /tmp/agent-orbit-bridge.log 2>&1 &`
  await $.process.run(['sh', '-c', start])
  for (let i = 0; i < 20; i++) {
    await $.clock.sleep(500)
    if (await up()) {
      bridgeDownUntil = 0
      return true
    }
  }
  return false
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // One id per chat, kept across reloads; the surfaces say whether it is the desktop app.
    const kept = await read($, sessionId).catch(() => '')
    if (kept) session.id = kept
    else await update($, sessionId, () => session.id).catch(() => {})
    const surfaces = await $.session.surfaces()
    session.surface = surfaces.includes('desktop') ? 'desktop' : (e.surface ?? 'terminal')
    session.label = `${session.surface === 'desktop' ? 'Desktop' : 'CLI'} · ${e.cwd.split('/').pop() ?? ''}`
    await $.command.register({ name: 'orbit', description: 'Open the live agent orbit; /orbit web opens the live web page' })
    void $.ui.open({ id: PANE, title: 'Agent orbit' })

    // The animation: about 16 frames a second, painted into the mounted Raster.
    $.clock.every(60, () => {
      const now = Date.now()
      if (size) {
        const cells = drawFrame(live, size.columns, size.rows, now)
        void $.ui.blit({ requestId: PANE, key: RASTER, cells, ...size }).catch(() => {})
      }
      mirror($, now)
      // The desktop SVG animates by itself; it only needs a redraw every 2 s while agents run.
      const busy = live.agents.some(a => a.endedAt === undefined)
      if (vectorShown && busy && now - lastRedraw > 2000) {
        lastRedraw = now
        void update($, version, v => v + 1).catch(() => {})
      }
    })

    return next(e)
  })

  on('command.run', { command: 'orbit' }, async ($, e) => {
    // `/orbit web` starts the bridge and opens the live page, like `/board`.
    if (e.args.trim() === 'web') {
      if (!(await ensureBridge($))) return { text: 'The bridge did not start. See /tmp/agent-orbit-bridge.log (it needs bun).' }
      await $.process.run(['open', BRIDGE])
      return { text: `The live orbit page is open: ${BRIDGE}` }
    }
    await $.ui.open({ id: PANE, title: 'Agent orbit' })
    return { text: 'Agent orbit opened. Type /orbit web for the live web page.' }
  })

  // A prompt the person enters counts as their ask: the pane opens at any width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent orbit' }).catch(() => {})
    if (e.origin.kind !== 'plugin') say(live, 'You give Main a task', LIME, Date.now())
    // The chat itself goes to the live page too: what was typed, and who sent it.
    addChat(live, e.origin.kind === 'plugin' ? 'plugin' : 'you', e.text, Date.now())
    await update($, version, v => v + 1).catch(() => {})
    return next(e)
  })

  // The context the session carries before its first word: its instruction files.
  on('prompt.context', async ($, e, next) => {
    live.files = (e.instructionFiles ?? []).map(file => `${file.kind}: ${baseName(file.path)}`)
    if (live.files.length > 0) say(live, `Main loads ${live.files.length} instruction files (CLAUDE.md)`, CYAN, Date.now())
    await update($, version, v => v + 1).catch(() => {})
    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    if (!live.skills.includes(e.skill)) live.skills.push(e.skill)
    say(live, `A skill loads: ${e.skill}`, CYAN, Date.now())
    return next(e)
  })

  // A new agent: it takes a slot in the orbit, and a star flies out to it.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny === undefined && started.agentId) {
      const agent = loopOf(started.agentId)
      const same = live.agents.filter(a => a.type === e.subagentType).length + 1
      agent.type = e.subagentType
      agent.name = `${e.subagentType} ${same}`
      agent.task = e.description
      agent.model = shortModel(started.model)
      agent.startedAt = Date.now()
      live.particles.push({ kind: 'spawn', agentId: agent.id, label: '', seed: 0, at: Date.now() })
      say(live, `Main hands ${agent.name} a task: "${e.description}" (${agent.model})`, LIME, Date.now())
      await update($, version, v => v + 1).catch(() => {})
    }
    return started
  })

  // Every tool call: a read flies in from outside, an action reports back to the core.
  on('tool.call', async ($, e, next) => {
    const agent = loopOf(e.agentId)
    const what = whatOf(e as unknown as Record<string, unknown>, e.tool)
    const step: Step = { tool: e.tool, what: verbOf(e.tool, what), isRead: READS.has(e.tool), at: Date.now() }
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
    await update($, version, v => v + 1).catch(() => {})
    return next(e)
  })

  // An agent ends: it parks with a check mark.
  on('turn.complete', async ($, e, next) => {
    // Claude's answer to the chat (the main loop, not an agent) goes to the live page.
    if (!e.agentId && !e.isAborted && e.answer.trim()) addChat(live, 'claude', e.answer.trim(), Date.now())
    if (e.agentId) {
      const agent = live.agents.find(a => a.id === e.agentId)
      if (agent && agent.endedAt === undefined) {
        agent.endedAt = Date.now()
        const s = Math.round((agent.endedAt - agent.startedAt) / 1000)
        say(live, `${agent.name} is done after ${s}s: read ${agent.reads}, did ${agent.acts}`, GREEN, Date.now())
      }
      await update($, version, v => v + 1).catch(() => {})

      // The mod talks back: when the last running agent ends, it sends a prompt to the chat.
      const wave = live.agents.filter(a => !reported.has(a.id))
      if (wave.length > 0 && wave.every(a => a.endedAt !== undefined)) {
        wave.forEach(a => reported.add(a.id))
        const lines = wave.map(
          a => `- ${a.name} (${a.model}), ${Math.round(((a.endedAt ?? 0) - a.startedAt) / 1000)}s, read ${a.reads}, did ${a.acts}: ${a.task}`,
        )
        say(live, 'The mod sends a debrief prompt to the chat', LIME, Date.now())
        await update($, version, v => v + 1).catch(() => {})
        void $.prompt
          .submit({
            text: [
              `Agent orbit saw ${wave.length} agent(s) finish:`,
              ...lines,
              'Give a debrief in at most 4 lines: which agent read the most, and the one finding of each agent.',
            ].join('\n'),
          })
          .catch(() => {})
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // The surface that draws the pane names this chat on the page (also after a reload).
    if (session.label === 'Claude Code') {
      session.surface = e.surface
      const folder = (await $.session.cwd().catch(() => '')).split('/').pop() ?? ''
      session.label = `${e.surface === 'desktop' ? 'Desktop' : 'CLI'} · ${folder}`
    }
    // The terminal: one Raster, painted by the clock above.
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const columns = Math.max(20, Math.min(160, e.props.bodyColumns))
      const rows = Math.max(10, Math.min(48, e.props.scroll.bodyRows))
      size = { columns, rows }
      return <Raster key={RASTER} columns={columns} rows={rows} cells={drawFrame(live, columns, rows, Date.now())} />
    }

    // The desktop: one animated SVG with hover tooltips, drawn again on each change.
    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      await read($, version)
      vectorShown = true
      lastRedraw = Date.now()
      return <Svg source={drawSvg(live, Date.now())} alt="Agent orbit: the main session, its agents, and the files they read" isInteractive={true} />
    }

    // Other surfaces: a plain text view of the same model.
    const { Box, Text } = $.ui.resolve(e)
    await read($, version)
    return (
      <Box flexDirection="column">
        <Text dimColor>The live orbit draws in the Claude CLI. Here is the list.</Text>
        {[live.main, ...live.agents].map(agent => (
          <Text>
            {agent.endedAt ? 'done' : 'runs'} · {agent.name} {agent.model} · read {agent.reads} · did {agent.acts}
          </Text>
        ))}
        {live.events.slice(-5).map(event => (
          <Text dimColor>{event.text}</Text>
        ))}
      </Box>
    )
  })
}
