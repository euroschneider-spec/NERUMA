import { describe, expect, test } from 'claude-code/testing';

import { add, complete, costLine, nextOpen, parse, render } from './ledger';

describe('ledger file', () => {
  test('a task survives being written and read back', async () => {
    const tasks = add([], 'Fold the resend section', 'Sign in page, DESIGN-TASKS section 4.');
    expect(parse(render(tasks))).toEqual(tasks);
  });

  test('ids count up and the next open task is the first one', async () => {
    const tasks = add(add([], 'one', 'a'), 'two', 'b');
    expect(tasks.map(task => task.id)).toEqual(['T-001', 'T-002']);
    expect(nextOpen(tasks)?.title).toBe('one');
  });

  test('a field cannot contain the separator', async () => {
    const [task] = add([], 'a | b', 'c | d');
    expect(task?.title).toBe('a / b');
    expect(parse(render([task!]))[0]?.context).toBe('c / d');
  });

  test('finishing a task keeps its note and cost, and moves on to the next', async () => {
    const tasks = complete(add(add([], 'one', 'a'), 'two', 'b'), 'T-001', 'done in one go', 'scout (haiku); main chat 1.0k in / 200 out');
    expect(tasks?.[0]).toMatchObject({ isDone: true, note: 'done in one go' });
    expect(nextOpen(tasks!)?.id).toBe('T-002');
    expect(parse(render(tasks!)).find(task => task.id === 'T-001')?.cost).toBe('scout (haiku); main chat 1.0k in / 200 out');
  });

  test('finishing an unknown or finished task changes nothing', async () => {
    const tasks = complete(add([], 'one', 'a'), 'T-001', 'x', 'y')!;
    expect(complete(tasks, 'T-001', 'x', 'y')).toBeUndefined();
    expect(complete(tasks, 'T-009', 'x', 'y')).toBeUndefined();
  });
});

describe('cost line', () => {
  test('names each helper once with its model and how often it ran', async () => {
    const runs = [{ agent: 'scout', model: 'haiku' }, { agent: 'scout', model: 'haiku' }, { agent: 'runner', model: 'haiku' }];
    expect(costLine(runs, 12300, 1100)).toBe('scout (haiku) x2, runner (haiku); main chat 12.3k in / 1.1k out');
  });

  test('says so when no helper ran', async () => {
    expect(costLine([], 900, 40)).toBe('no helpers; main chat 900 in / 40 out');
  });
});
