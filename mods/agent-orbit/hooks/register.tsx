import type { Register } from 'claude-code'

const PANE = 'agent-orbit'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'orbit', description: 'Open the live agent orbit' })
    void $.ui.open({ id: PANE, title: 'Agent orbit' })
    return next(e)
  })

  on('command.run', { command: 'orbit' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent orbit' })
    return { text: 'Agent orbit opened.' }
  })

  // A prompt the person enters counts as their ask: the pane opens at any width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Agent orbit' }).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>Hello, orbit</Text>
  })
}
