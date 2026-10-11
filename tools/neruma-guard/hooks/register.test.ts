import { expect, test } from 'claude-code/testing'

const ok = () => ({ result: { stdout: '', stderr: '' } as never })

const edit = (file_path: string) =>
  ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as const

const bash = (command: string) => ({ tool: 'Bash', command }) as const

test('secrets files are never edited', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, ok)
  const refused = await $.tool.call(edit('/repo/.env'))
  expect(refused.deny).toContain('secrets file')
  const template = await $.tool.call(edit('/repo/.env.example'))
  expect(template.deny).toBeUndefined()
})

test('a docs-only commit needs no checks', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, ok)
  on('tool.call', { tool: 'Bash' }, ok)
  await $.tool.call(edit('/repo/docs/planning/DECISIONS.md'))
  const commit = await $.tool.call(bash('git commit -m "docs"'))
  expect(commit.deny).toBeUndefined()
})

test('a commit after a code change waits for the checks', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, ok)
  on('tool.call', { tool: 'Bash' }, ok)
  await $.tool.call(edit('/repo/src/lib/roles.ts'))

  const blocked = await $.tool.call(bash('git commit -m "x"'))
  expect(blocked.deny).toContain('typecheck, lint, unit')

  await $.tool.call(bash('npm run typecheck && npm run lint && npm run test:unit'))
  const allowed = await $.tool.call(bash('git commit -m "x"'))
  expect(allowed.deny).toBeUndefined()

  const pr = await $.tool.call(bash('gh pr create --title x'))
  expect(pr.deny).toContain('db, workspace')
})

test('editing code again asks for the checks again', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, ok)
  on('tool.call', { tool: 'Bash' }, ok)
  await $.tool.call(edit('/repo/src/a.ts'))
  await $.tool.call(bash('npm run typecheck && npm run lint && npm run test:unit'))
  await $.tool.call(edit('/repo/src/b.ts'))
  const blocked = await $.tool.call(bash('git commit -m "x"'))
  expect(blocked.deny).toContain('typecheck')
})

test('Playwright needs PORT', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, ok)
  const refused = await $.tool.call(bash('npx playwright test tests/platform.spec.ts'))
  expect(refused.deny).toContain('PORT=3100')
  const allowed = await $.tool.call(bash('PORT=3100 npx playwright test tests/platform.spec.ts'))
  expect(allowed.deny).toBeUndefined()
})
