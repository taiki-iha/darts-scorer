import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import type { Dart } from '../core/types';
import type { X01Options } from './types';
import { checkoutHint, defaultRoundsFor, x01, type X01State } from './x01';

const opts = (o: Partial<X01Options> = {}): X01Options => ({ ...x01.defaults(), ...o });

/** 1サイドのゲームでターンを開始し、ダーツを順に投げる */
function turn(s: X01State, o: X01Options, darts: Dart[], side = 0) {
  s = x01.startTurn(s, side);
  let last = { state: s } as ReturnType<typeof x01.throwDart>;
  for (const d of darts) {
    last = x01.throwDart(last.state, o, side, d);
    if (last.bust || last.finished) break;
  }
  return last;
}
const withRemaining = (o: X01Options, rem: number, opened = true): X01State => {
  const s = x01.init(o, 1);
  return { ...s, remaining: [rem], opened: [opened] };
};

describe('x01 defaults', () => {
  test('defaults', () => {
    expect(x01.defaults()).toEqual({ start: 501, in: 'open', out: 'open', bull: 'fat', maxRounds: 15 });
  });
  test('default rounds by start', () => {
    expect(defaultRoundsFor(301)).toBe(10);
    expect(defaultRoundsFor(501)).toBe(15);
    expect(defaultRoundsFor(701)).toBe(20);
    expect(defaultRoundsFor(1501)).toBe(20);
    expect(x01.maxRounds(opts({ maxRounds: 12 }))).toBe(12);
  });
});

describe('x01 scoring', () => {
  test('open in/out subtracts', () => {
    const o = opts();
    const r = turn(x01.init(o, 2), o, [dart('T', 20), dart('T', 20), dart('T', 20)]);
    expect(r.state.remaining).toEqual([321, 501]);
  });
  test('bust restores turn start', () => {
    const o = opts();
    const r = turn(withRemaining(o, 40), o, [dart('S', 5), dart('T', 20)]);
    expect(r.bust).toBe(true);
    expect(r.state.remaining).toEqual([40]);
  });
  test('double out', () => {
    const o = opts({ out: 'double' });
    expect(turn(withRemaining(o, 32), o, [dart('D', 16)]).finished).toBe(true);
    const r = turn(withRemaining(o, 32), o, [dart('S', 16), dart('S', 16)]);
    expect(r.bust).toBe(true);
    expect(r.state.remaining).toEqual([32]);
    expect(turn(withRemaining(o, 3), o, [dart('S', 2)]).bust).toBe(true);
    expect(turn(withRemaining(o, 50), o, [dart('DB')]).finished).toBe(true);
    expect(turn(withRemaining(o, 50), o, [dart('SB')]).bust).toBe(true);
  });
  test('master out allows triples', () => {
    const o = opts({ out: 'master' });
    expect(turn(withRemaining(o, 60), o, [dart('T', 20)]).finished).toBe(true);
    expect(turn(withRemaining(o, 20), o, [dart('S', 20)]).bust).toBe(true);
  });
  test('open out finishes with any dart', () => {
    const o = opts();
    expect(turn(withRemaining(o, 5), o, [dart('S', 5)]).finished).toBe(true);
  });
  test('double in', () => {
    const o = opts({ in: 'double' });
    let r = turn(x01.init(o, 1), o, [dart('S', 20)]);
    expect(r.state.remaining).toEqual([501]);
    expect(r.state.opened).toEqual([false]);
    r = turn(x01.init(o, 1), o, [dart('S', 20), dart('D', 20), dart('S', 1)]);
    expect(r.state.remaining).toEqual([501 - 40 - 1]);
    expect(r.state.opened).toEqual([true]);
  });
  test('bust also reverts opened state', () => {
    const o = opts({ start: 301, in: 'double' });
    const s = { ...x01.init(o, 1), remaining: [40] };
    const r = turn(s, o, [dart('D', 20), dart('S', 1)]);
    // D20 で 0 → open out なので上がり。別ケース: D19 で開いて残り2、S5 でバースト
    expect(r.finished).toBe(true);
    const r2 = turn(s, o, [dart('D', 19), dart('S', 5)]);
    expect(r2.bust).toBe(true);
    expect(r2.state.opened).toEqual([false]);
    expect(r2.state.remaining).toEqual([40]);
  });
  test('separate bull', () => {
    const o = opts({ bull: 'separate' });
    expect(turn(x01.init(o, 1), o, [dart('SB')]).state.remaining).toEqual([476]);
  });
  test('limitWinners lowest remaining', () => {
    const o = opts();
    const s = { ...x01.init(o, 3), remaining: [40, 12, 12] };
    expect(x01.limitWinners(s)).toEqual([1, 2]);
  });
});

describe('checkoutHint', () => {
  test('double out', () => {
    expect(checkoutHint(170, 'double', 'fat')).toEqual(['T20', 'T20', 'D-BULL']);
    expect(checkoutHint(169, 'double', 'fat')).toBeNull();
    expect(checkoutHint(40, 'double', 'fat')).toEqual(['D20']);
    expect(checkoutHint(100, 'double', 'fat')).toEqual(['T20', 'D20']);
    expect(checkoutHint(60, 'double', 'fat')).toEqual(['20', 'D20']);
    expect(checkoutHint(1, 'double', 'fat')).toBeNull();
  });
  test('respects darts left in the turn', () => {
    expect(checkoutHint(100, 'double', 'fat', 1)).toBeNull();
    expect(checkoutHint(100, 'double', 'fat', 2)).toEqual(['T20', 'D20']);
    expect(checkoutHint(40, 'double', 'fat', 1)).toEqual(['D20']);
    expect(checkoutHint(170, 'double', 'fat', 2)).toBeNull();
  });
  test('open out lists bigger darts first', () => {
    const h = checkoutHint(91, 'open', 'fat', 2)!;
    expect(h).toHaveLength(2);
    expect(h[0].startsWith('T')).toBe(true);
  });
  test('open out', () => {
    expect(checkoutHint(50, 'open', 'fat')).toEqual(['BULL']);
    expect(checkoutHint(180, 'open', 'fat')).toBeNull();
    expect(checkoutHint(171, 'open', 'fat')).toBeNull();
  });
});
