import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { drawFrame } from './frame'
import type { Agent, Step } from './live'
import { AMBER, CYAN, GREEN, LIME, MAIN, PALETTE, baseName, blankAgent, hash, newLive, say, shortModel, verbOf } from './live'

const PANE = 'agent-orbit'
const RASTER = 'orbit'
const READS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Skill', 'LS'])

// A counter for the text view on surfaces without a Raster.
const version = atom({ plugin: 'agent-orbit', key: 'version' } as const, 0)

// The live model and the size of the mounted Raster. Both start over on a reload.
const live = newLive(Date.now())
let size: { columns: number; rows: number } | undefined

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'orbit', description: 'Open the live agent orbit' })
    void $.ui.open({ id: PANE, title: 'Agent orbit' })

    // The animation: about 16 frames a second, painted into the mounted Raster.
    $.clock.every(60, () => {
      const now = Date.now()
      if (size) {
        const cells = drawFrame(live, size.columns, size.rows, now)
        void $.ui.blit({ requestId: PANE, key: RASTER, cells, ...size }).catch(() => {})
      }
    })

    return next(e)
  })

  on('command.run', { command: 'orbit' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent orbit' })
    return { text: 'Agent orbit opened.' }
  })

  // A prompt the person enters counts as their ask: the pane opens at any width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent orbit' }).catch(() => {})
    if (e.origin.kind !== 'plugin') say(live, 'You give Main a task', LIME, Date.now())
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
    if (e.agentId) {
      const agent = live.agents.find(a => a.id === e.agentId)
      if (agent && agent.endedAt === undefined) {
        agent.endedAt = Date.now()
        const s = Math.round((agent.endedAt - agent.startedAt) / 1000)
        say(live, `${agent.name} is done after ${s}s: read ${agent.reads}, did ${agent.acts}`, GREEN, Date.now())
      }
      await update($, version, v => v + 1).catch(() => {})
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // The terminal: one Raster, painted by the clock above.
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const columns = Math.max(20, Math.min(160, e.props.bodyColumns))
      const rows = Math.max(10, Math.min(48, e.props.scroll.bodyRows))
      size = { columns, rows }
      return <Raster key={RASTER} columns={columns} rows={rows} cells={drawFrame(live, columns, rows, Date.now())} />
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
