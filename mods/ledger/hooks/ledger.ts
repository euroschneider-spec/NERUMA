// The ledger file and the few things done with it. No engine calls here, so it can be tested on its own.
export type Task = { id: string; title: string; context: string; isDone: boolean; note: string; cost: string };

export const LEDGER_PATH = 'docs/ledger/LEDGER.md';

const HEADER = `# Ledger

Small tasks for Claude Code chats, so a fresh chat can start from one line ("do the next task").
Read and changed with \`/ledger\` (see \`mods/ledger\`); it can also be edited by hand.
One task per line, fields split by " | ". Open: \`- [ ] T-001 | title | context\`.
Done: \`- [x] T-001 | title | note | cost\`.
`;

// A field may not contain the separator, or the line would read back as more fields.
const clean = (text: string) => text.replace(/\s*\|\s*/g, ' / ').replace(/\s+/g, ' ').trim();

export function parse(text: string): Task[] {
  const tasks: Task[] = [];
  for (const line of text.split('\n')) {
    const match = /^- \[( |x)\] (T-\d+) \| (.*)$/.exec(line);
    if (!match) continue;
    const fields = (match[3] ?? '').split(' | ');
    const isDone = match[1] === 'x';
    tasks.push({
      id: match[2] ?? '',
      title: fields[0] ?? '',
      context: isDone ? '' : (fields[1] ?? ''),
      isDone,
      note: isDone ? (fields[1] ?? '') : '',
      cost: isDone ? (fields[2] ?? '') : '',
    });
  }
  return tasks;
}

export function render(tasks: readonly Task[]): string {
  const open = tasks.filter(task => !task.isDone).map(task => `- [ ] ${task.id} | ${task.title} | ${task.context}`);
  const done = tasks.filter(task => task.isDone).map(task => `- [x] ${task.id} | ${task.title} | ${task.note} | ${task.cost}`);
  return `${HEADER}\n## Open\n\n${open.join('\n')}\n\n## Done\n\n${done.join('\n')}\n`;
}

export const nextOpen = (tasks: readonly Task[]) => tasks.find(task => !task.isDone);

export function add(tasks: readonly Task[], title: string, context: string): Task[] {
  const highest = Math.max(0, ...tasks.map(task => Number(task.id.slice(2))));
  const id = `T-${String(highest + 1).padStart(3, '0')}`;
  return [...tasks, { id, title: clean(title), context: clean(context), isDone: false, note: '', cost: '' }];
}

// undefined when no open task has that id.
export function complete(tasks: readonly Task[], id: string, note: string, cost: string): Task[] | undefined {
  if (!tasks.some(task => task.id === id && !task.isDone)) return undefined;
  return tasks.map(task => (task.id === id ? { ...task, isDone: true, context: '', note: clean(note), cost: clean(cost) } : task));
}

export type Run = { agent: string; model: string };

// "scout (haiku) x2; tokens 12.3k in / 1.1k out". Helpers by name and model, so the ledger shows who did the work.
export function costLine(runs: readonly Run[], input: number, output: number): string {
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(`${run.agent} (${run.model})`, (counts.get(`${run.agent} (${run.model})`) ?? 0) + 1);
  const helpers = [...counts].map(([name, n]) => (n > 1 ? `${name} x${n}` : name)).join(', ') || 'no helpers';
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return `${helpers}; main chat ${k(input)} in / ${k(output)} out`;
}
