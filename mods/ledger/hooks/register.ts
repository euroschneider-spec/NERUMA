import type { Register } from 'claude-code';

import { add, complete, costLine, LEDGER_PATH, nextOpen, parse, render, type Run } from './ledger';

const RUNS = 'ledger:runs';
const USAGE = 'ledger:usage';

type Usage = { input: number; output: number };

const HELP = [
  '/ledger            the next open tasks',
  '/ledger add <title> | <context>',
  '/ledger done <id> | <what was done>   (adds the helpers used and the tokens spent)',
].join('\n');

export const register: Register = on => {
  // A fresh chat starts counting from nothing.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ledger', description: 'Show, add or finish tasks in docs/ledger/LEDGER.md' });
    await $.store.set(RUNS, []);
    await $.store.set(USAGE, { input: 0, output: 0 });
    return next(e);
  });

  on('command.run', { command: 'ledger' }, async ($, e) => {
    const args = e.args.trim();
    const tasks = parse(await $.fs.read(LEDGER_PATH).catch(() => ''));
    if (args === '') {
      const open = tasks.filter(task => !task.isDone).slice(0, 5);
      return { text: open.length ? open.map(task => `${task.id}  ${task.title}\n       ${task.context}`).join('\n') : 'No open tasks.\n\n' + HELP };
    }
    if (args.startsWith('add ')) {
      const [title = '', ...context] = args.slice(4).split('|');
      if (!title.trim()) return { text: HELP };
      const next = add(tasks, title, context.join('|'));
      await $.fs.write(LEDGER_PATH, render(next));
      return { text: `Added ${next[next.length - 1]?.id}.` };
    }
    if (args.startsWith('done ')) {
      const [id = '', ...note] = args.slice(5).split('|');
      const runs = ((await $.store.get(RUNS)) ?? []) as Run[];
      const usage = ((await $.store.get(USAGE)) ?? { input: 0, output: 0 }) as Usage;
      const finished = complete(tasks, id.trim(), note.join('|'), costLine(runs, usage.input, usage.output));
      if (!finished) return { text: `No open task ${id.trim()}.\n\n${HELP}` };
      await $.fs.write(LEDGER_PATH, render(finished));
      await $.store.set(RUNS, []);
      await $.store.set(USAGE, { input: 0, output: 0 });
      return { text: `${id.trim()} done. ${costLine(runs, usage.input, usage.output)}` };
    }
    return { text: HELP };
  });

  // The next task goes into the system prompt, so "do the next task" needs no explaining.
  on('prompt.compose', async ($, e, next) => {
    const answer = await next(e);
    const task = nextOpen(parse(await $.fs.read(LEDGER_PATH).catch(() => '')));
    if (!task) return answer;
    const text = `Ledger: the next open task is ${task.id}, "${task.title}". Context: ${task.context} The whole list is ${LEDGER_PATH}. When the owner says "next task", start it; when it is finished, run /ledger done ${task.id} | <what was done>.`;
    return { sections: [...answer.sections, { id: 'ledger-next', text, scope: 'session' as const }] };
  });

  // Which helper ran on which model, for the line /ledger done writes.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e);
    if (started.deny === undefined) {
      const runs = ((await $.store.get(RUNS)) ?? []) as Run[];
      await $.store.set(RUNS, [...runs, { agent: e.subagentType.replace(/^.*:/, ''), model: started.model }]);
    }
    return started;
  }).catch(($, e, next) => next(e)); // Bookkeeping must never stop a helper from running.

  on('turn.complete', async ($, e, next) => {
    if (e.usage && e.agentId === undefined) {
      const usage = ((await $.store.get(USAGE)) ?? { input: 0, output: 0 }) as Usage;
      await $.store.set(USAGE, {
        input: usage.input + e.usage.input_tokens + (e.usage.cache_read_input_tokens ?? 0),
        output: usage.output + e.usage.output_tokens,
      });
    }
    return next(e);
  });
};
