import type { Register } from 'claude-code'

// The id of this mod's pane. Rename the mod in .claude-plugin/plugin.json too.
const PANE = 'my-mod'

export const register: Register = on => {
  // When a chat starts: register a /hello command and open the pane.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hello', description: 'Open the my-mod pane' })
    void $.ui.open({ id: PANE, title: 'My mod' })
    return next(e)
  })

  // /hello opens the pane on request.
  on('command.run', { command: 'hello' }, async $ => {
    await $.ui.open({ id: PANE, title: 'My mod' })
    return { text: 'My mod is open.' }
  })

  // A prompt the person types counts as their ask: the pane then opens at any terminal width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'My mod' }).catch(() => {})
    return next(e)
  })

  // What the pane draws. Start here: add hooks above, keep what they see, draw it below.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text bold>Hello from my mod</Text>
        <Text dimColor>Edit hooks/register.tsx to make it yours.</Text>
      </Box>
    )
  })
}
