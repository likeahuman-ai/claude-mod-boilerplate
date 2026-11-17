import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agent, Context, Step } from '../types'

const PANE = 'agent-watch'
const MAIN = 'main'

// Two values the pane reads. A write to either one redraws the pane.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [] as Agent[], {
  shape: 'agents-1',
})
const context = atom(
  { plugin: 'agent-watch', key: 'context' } as const,
  { files: [], blocks: [], skills: [] } as Context,
  { shape: 'context-1' },
)

// Tools that only read: these are the "context" an agent pulls in.
const READS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Skill'])

// What a tool call touched, in a few words.
function whatOf(tool: string, input: Record<string, unknown>): string {
  const field = ['file_path', 'pattern', 'url', 'query', 'skill', 'command', 'description']
    .map(key => input[key])
    .find(value => typeof value === 'string')
  return String(field ?? tool).replace(/^.*\/(?=[^/]+\/[^/]+$)/, '…/')
}

function short(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export const register: Register = on => {
  // A prompt the person types counts as their ask: the pane opens at any terminal width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent watch' }).catch(() => {})
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agent-watch', description: 'Show what the agents do and read' })
    void $.ui.open({ id: PANE, title: 'Agent watch' })
    return next(e)
  })

  on('command.run', { command: 'agent-watch' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent watch' })
    return { text: 'Agent watch pane opened.' }
  })

  // 1. The context: which instruction files (CLAUDE.md and others) the session carries.
  on('prompt.context', async ($, e, next) => {
    const files = (e.instructionFiles ?? []).map(file => `${file.kind}: ${file.path}`)
    const blocks = e.blocks.map(block => block.name)
    await update($, context, old => ({ ...old, files, blocks })).catch(() => {})
    return next(e)
  })

  // 2. The skills: each skill that loads its instructions.
  on('skill.prompt', async ($, e, next) => {
    await update($, context, old =>
      old.skills.includes(e.skill) ? old : { ...old, skills: [...old.skills, e.skill] },
    ).catch(() => {})
    return next(e)
  })

  // 3. A new agent: its type, its task and its model.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny === undefined && started.agentId) {
      const agent: Agent = {
        id: started.agentId,
        type: e.subagentType,
        task: e.description,
        model: started.model,
        isDone: false,
        steps: [],
      }
      await update($, agents, list => [...list, agent].slice(-20)).catch(() => {})
    }
    return started
  })

  // 4. Every tool call, filed under the loop that made it.
  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const step: Step = { tool: e.tool, what: whatOf(e.tool, input), isRead: READS.has(e.tool) }
    const id = e.agentId ?? MAIN
    await update($, agents, list => {
      const known = list.some(agent => agent.id === id)
      const all = known
        ? list
        : [{ id, type: id === MAIN ? 'main session' : 'agent', task: '', model: '', isDone: false, steps: [] }, ...list]
      return all.map(agent =>
        agent.id === id ? { ...agent, steps: [...agent.steps, step].slice(-40) } : agent,
      )
    }).catch(() => {})
    return next(e)
  })

  // 5. An agent ends its turn.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      await update($, agents, list =>
        list.map(agent => (agent.id === id ? { ...agent, isDone: true } : agent)),
      ).catch(() => {})
    }
    return next(e)
  })

  // The pane: context on top, then one block per agent.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const ctx = await read($, context)
    const list = await read($, agents)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Context before the first word</Text>
          {ctx.files.length === 0 && <Text dimColor>No instruction files seen yet.</Text>}
          {ctx.files.map(file => <Text dimColor>{short(file, 80)}</Text>)}
          {ctx.blocks.length > 0 && <Text dimColor>blocks: {ctx.blocks.join(', ')}</Text>}
          {ctx.skills.length > 0 && <Text dimColor>skills: {ctx.skills.join(', ')}</Text>}
        </Box>

        {list.length === 0 && <Text dimColor>No agent has run yet.</Text>}
        {list.map(agent => {
          const reads = agent.steps.filter(step => step.isRead)
          const acts = agent.steps.filter(step => !step.isRead)
          return (
            <Box flexDirection="column">
              <Text bold>
                {agent.isDone ? 'done' : 'runs'} · {agent.type}
                {agent.model ? ` · ${agent.model}` : ''}
              </Text>
              {agent.task !== '' && <Text>task: {short(agent.task, 70)}</Text>}
              <Text dimColor>
                read {reads.length} · did {acts.length}
              </Text>
              {agent.steps.slice(-5).map(step => (
                <Text dimColor={step.isRead}>
                  {step.isRead ? 'reads' : 'does '} {step.tool} {short(step.what, 60)}
                </Text>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
