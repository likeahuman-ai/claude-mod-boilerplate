import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// The three board files, read from the session's working directory.
const FILES = ['PROBLEMS.md', 'SUGGESTIONS.md', 'PARKING.md']
const PANE = 'mini-board'

// A counter: each change bumps it, and the pane redraws.
const tick = atom({ plugin: 'mini-board', key: 'tick' } as const, 0)

export const register: Register = on => {
  // A prompt the person types counts as their ask: the pane opens at any terminal width.
  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'Mini board' }).catch(() => {})
    return next(e)
  })

  // Step 2: open the pane and register /note when the session starts.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'note', description: 'Park a thought on the mini board' })
    void $.ui.open({ id: PANE, title: 'Mini board' })
    return next(e)
  })

  // Step 3: draw the pane from the files.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, tick)
    const lists = await Promise.all(
      FILES.map(async file => {
        const text = await $.fs.read(file).catch(() => '')
        return { file, lines: text.split('\n').filter(line => line.startsWith('- ')) }
      }),
    )

    return (
      <Box flexDirection="column" gap={1}>
        {lists.map(({ file, lines }) => (
          <Box flexDirection="column">
            <Text bold>
              {file.replace('.md', '')} · {lines.length}
            </Text>
            {lines.length === 0 && <Text dimColor>Nothing here yet.</Text>}
            {lines.slice(-3).map(line => (
              <Text dimColor>{line.length > 80 ? `${line.slice(0, 79)}…` : line}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })

  // Step 4: /note <text> adds a line to PARKING.md.
  on('command.run', { command: 'note' }, async ($, e) => {
    const thought = e.args.trim()
    if (!thought) return { text: 'Usage: /note <thought>' }
    const old = await $.fs.read('PARKING.md').catch(() => '# Parking\n')
    await $.fs.write('PARKING.md', `${old.trimEnd()}\n- ${thought}\n`)
    await update($, tick, n => n + 1).catch(() => {})
    $.ui.toast('Parked on the mini board')
    return { text: `Parked: ${thought}` }
  })

  // Bonus: when Claude edits a board file, the pane redraws too.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (FILES.some(file => e.file_path.endsWith(file))) await update($, tick, n => n + 1).catch(() => {})
    return ran
  })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (FILES.some(file => e.file_path.endsWith(file))) await update($, tick, n => n + 1).catch(() => {})
    return ran
  })
}
