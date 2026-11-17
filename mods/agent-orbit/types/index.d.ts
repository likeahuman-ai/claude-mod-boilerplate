/** Bumped on each change, so a non-terminal pane redraws its text view. */
export type Version = number

declare module 'claude-code' {
  interface PluginState {
    'agent-orbit': { version: Version; sessionId: string }
  }
}
