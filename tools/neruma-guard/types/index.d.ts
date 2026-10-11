export type Guard = { passed: string[]; owed: boolean }

declare module 'claude-code' {
  interface PluginState {
    'neruma-guard': { passed: string[]; owed: boolean }
  }
}
