import type { Register } from 'claude-code'

const RULES = [
  'NERUMA project rules (full text in CLAUDE.md, GOTCHA.md, docs/guides/TESTING.md):',
  '- Non-trivial work starts from a brief in docs/briefs/. Read it first; check "Done when" before saying finished.',
  '- docs/planning/DECISIONS.md records deliberate choices. Do not re-open one without the owner saying what changed.',
  '- Reuse before writing new code. Never cut validation, auth checks, accessibility or EN/RO/DE copy.',
  '- Before a commit: npm run typecheck && npm run lint && npm run test:unit. Before a pull request also npm run test:db and npm run test:workspace.',
  '- Playwright always runs with PORT=3100. After test:workspace run npm run build first.',
  '- After tests, git status for .png changes in docs/verification/screenshots; restore them unless meant to change.',
  '- Say plainly what you changed, what you ran and what you did not run.',
].join('\n')

const CHECKS: [string, RegExp][] = [
  ['typecheck', /npm run (typecheck|check)\b/],
  ['lint', /npm run (lint|check)\b/],
  ['unit', /npm run (test:unit|check)\b/],
  ['db', /npm run (test:db|check)\b/],
  ['workspace', /npm run test:workspace\b/],
]
const BEFORE_COMMIT = ['typecheck', 'lint', 'unit']
const BEFORE_PR = [...BEFORE_COMMIT, 'db', 'workspace']

const CODE = /(^|\/)(src|tests|scripts)\/|(^|\/)package\.json$/
const ENV = /(^|\/)\.env(\.(?!example)|$)/

const state = { plugin: 'neruma-guard', key: 'passed' } as const
const owedState = { plugin: 'neruma-guard', key: 'owed' } as const

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    $.ui.toast('neruma-guard: project rules on')
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return {
      sections: [
        ...composed.sections,
        { id: 'neruma-guard:rules', text: RULES, scope: 'session' },
      ],
    }
  })

  for (const tool of ['Edit', 'Write'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      if (ENV.test(e.file_path)) {
        return { deny: `neruma-guard: ${e.file_path} is a secrets file. Edit it yourself; it never goes through Claude.` }
      }
      if (CODE.test(e.file_path)) {
        await $.state.set(state, [])
        await $.state.set(owedState, true)
      }
      return next(e)
    }).catch(($, e, next) =>
      next.called ? next(e) : { deny: 'neruma-guard: its guard failed on this edit.' },
    )
  }

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.command

    if (/playwright test|npm run test:e2e/.test(command) && !/\bPORT=\d+/.test(command)) {
      return {
        deny: 'neruma-guard: run Playwright with PORT=3100 (for example PORT=3100 npx playwright test tests/platform.spec.ts). A running dev server otherwise breaks hydration; see GOTCHA.md.',
      }
    }

    const needs = /\bgh\s+pr\s+create\b/.test(command)
      ? BEFORE_PR
      : /\bgit\s+commit\b/.test(command)
        ? BEFORE_COMMIT
        : null

    if (needs) {
      const { value: owed = false } = await $.state.get(owedState)
      const { value: passed = [] } = await $.state.get(state)
      const missing = needs.filter(name => !passed.includes(name))
      if (owed && missing.length > 0) {
        return {
          deny: `neruma-guard: code changed since the checks last passed. Still to run: ${missing.join(', ')} (npm run typecheck && npm run lint && npm run test:unit; test:db and test:workspace before a pull request). Run them, then try again.`,
        }
      }
    }

    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      const names = CHECKS.filter(([, pattern]) => pattern.test(command)).map(([name]) => name)
      if (names.length > 0) {
        const { value: passed = [] } = await $.state.get(state)
        await $.state.set(state, [...new Set([...passed, ...names])])
      }
    }
    return ran
  })
}
