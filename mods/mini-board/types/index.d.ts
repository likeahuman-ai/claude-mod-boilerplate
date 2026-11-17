export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    'mini-board': { tick: Tick }
  }
}
