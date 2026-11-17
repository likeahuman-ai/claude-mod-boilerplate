import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-watch',
  component: 'Pane',
  requestId: 'agent-watch',
  props: {
    title: 'Agent watch',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('the pane shows an agent, its task and what it read', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-watch' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'Find the login code', description: 'Find login code', subagentType: 'Explore' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth/login.ts', agentId: 'a1' })
  await $.tool.call({ tool: 'Bash', command: 'ls', })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Explore/ }))?.text).toBe('runs · Explore · claude-sonnet-5-5')
  expect((await ui.find({ type: 'Text', text: /^task/ }))?.text).toBe('task: Find login code')
  expect((await ui.find({ type: 'Text', text: /login\.ts/ }))?.text).toBe('reads Read …/auth/login.ts')
  expect((await ui.find({ type: 'Text', text: /main session/ }))?.text).toBe('runs · main session')
  await ui.unmount()
})
