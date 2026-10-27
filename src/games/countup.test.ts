import { expect, test } from 'vitest';
import { dart } from '../core/dart';
import { countup } from './countup';
import { GAMES } from './registry';

test('count-up sums with fat bull', () => {
  const o = countup.defaults();
  let s = countup.startTurn(countup.init(o, 2), 0);
  for (const d of [dart('T', 20), dart('SB'), dart('DB')]) {
    const r = countup.throwDart(s, o, 0, d);
    expect(r.finished).toBeFalsy();
    s = r.state;
  }
  expect(s.total).toEqual([160, 0]);
});

test('count-up has 8 rounds', () => {
  expect(countup.defaults()).toEqual({ rounds: 8 });
  expect(countup.maxRounds(countup.defaults())).toBe(8);
});

test('count-up limit winners are highest totals', () => {
  const o = countup.defaults();
  expect(countup.limitWinners({ ...countup.init(o, 3), total: [300, 500, 500] })).toEqual([1, 2]);
});

test('registry', () => {
  expect(GAMES.x01.family).toBe('x01');
  expect(GAMES.cricket.name).toBe('CRICKET');
  expect(GAMES.countup.name).toBe('COUNT-UP');
  expect(GAMES.countup.rule.id).toBe('countup');
});
