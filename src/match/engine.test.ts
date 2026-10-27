import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import type { Dart } from '../core/types';
import { x01 } from '../games/x01';
import { apply, currentPlayer, currentSide, newMatch, replay } from './engine';
import type { MatchConfig, MatchEvent, MatchState } from './types';

const p = (name: string) => ({ playerId: name, name });
const single = (names: string[], extra: Partial<MatchConfig> = {}): MatchConfig => ({
  gameId: 'x01',
  options: { ...x01.defaults(), start: 501 },
  mode: 'single',
  sides: names.map((n) => ({ name: n, members: [p(n)] })),
  legsToWin: 1,
  ...extra,
});
const D = (d: Dart): MatchEvent => ({ t: 'dart', d });
const NEXT: MatchEvent = { t: 'next' };
const T20 = D(dart('T', 20));
const MISS = D(dart('MISS'));
const run = (cfg: MatchConfig, ev: MatchEvent[]) => ev.reduce(apply, newMatch(cfg));
const remaining = (s: MatchState) => (s.game as { remaining: number[] }).remaining;

describe('turns', () => {
  test('three darts complete the turn, next passes to B, round advances', () => {
    const cfg = single(['A', 'B']);
    let s = run(cfg, [T20, T20, T20]);
    expect(s.turnComplete).toBe(true);
    expect(remaining(s)).toEqual([321, 501]);
    s = apply(s, NEXT);
    expect(currentSide(s)).toBe(1);
    expect(s.round).toBe(1);
    s = [T20, T20, T20, NEXT].reduce(apply, s);
    expect(s.round).toBe(2);
    expect(currentPlayer(s).name).toBe('A');
  });
  test('next ends a turn early', () => {
    const s = run(single(['A', 'B']), [T20, NEXT]);
    expect(currentSide(s)).toBe(1);
    expect(s.turnDarts).toEqual([]);
    expect(s.lastTurn?.darts).toEqual([dart('T', 20)]);
  });
  test('darts during a completed turn are ignored', () => {
    const s = run(single(['A', 'B']), [T20, T20, T20, T20]);
    expect(remaining(s)).toEqual([321, 501]);
  });
});

describe('finishing', () => {
  test('checkout ends leg and match', () => {
    const cfg = single(['A', 'B'], { options: { ...x01.defaults(), start: 301 } });
    // A: 180, B: miss, A: 121 = T20 T20 1
    const s = run(cfg, [T20, T20, T20, NEXT, MISS, NEXT, T20, T20, D(dart('S', 1))]);
    expect(s.legOver).toBe(true);
    expect(s.legWinners).toEqual([0]);
    expect(s.matchOver).toBe(true);
    expect(s.matchWinner).toBe(0);
    expect(s.lastTurn?.finished).toBe(true);
  });
  test('legs: second leg starts with B', () => {
    const cfg = single(['A', 'B'], { options: { ...x01.defaults(), start: 301 }, legsToWin: 2 });
    let s = run(cfg, [T20, T20, T20, NEXT, MISS, NEXT, T20, T20, D(dart('S', 1))]);
    expect(s.matchOver).toBe(false);
    expect(s.legWins).toEqual([1, 0]);
    s = apply(s, NEXT);
    expect(s.leg).toBe(1);
    expect(currentSide(s)).toBe(1);
    expect(remaining(s)).toEqual([301, 301]);
    expect(s.round).toBe(1);
  });
  test('round limit applies limitWinners (count-up 8 rounds)', () => {
    const cfg: MatchConfig = { ...single(['A', 'B']), gameId: 'countup', options: { rounds: 8 } };
    const ev: MatchEvent[] = [];
    for (let r = 0; r < 8; r++) ev.push(T20, NEXT, MISS, NEXT);
    // 最後の 'next' で B の最終ターンが終わり、上限判定が走る
    expect(run(cfg, ev.slice(0, -1)).legOver).toBe(false);
    const s = run(cfg, ev);
    expect(s.legOver).toBe(true);
    expect(s.matchWinner).toBe(0);
  });
  test('draw at limit gives no leg and moves to next leg', () => {
    const cfg: MatchConfig = { ...single(['A', 'B']), gameId: 'countup', options: { rounds: 1 }, legsToWin: 1 };
    let s = run(cfg, [T20, NEXT, T20, NEXT]);
    expect(s.legOver).toBe(true);
    expect(s.legWinners).toEqual([0, 1]);
    expect(s.legWins).toEqual([0, 0]);
    expect(s.matchOver).toBe(false);
    s = apply(s, NEXT);
    expect(s.leg).toBe(1);
  });
});

describe('teams', () => {
  test('unequal teams rotate members independently', () => {
    const cfg: MatchConfig = {
      ...single([]),
      mode: 'team',
      sides: [
        { name: 'A', members: [p('a1'), p('a2')] },
        { name: 'B', members: [p('b1'), p('b2'), p('b3')] },
      ],
    };
    let s = newMatch(cfg);
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      seen.push(currentPlayer(s).name);
      s = apply(s, NEXT);
    }
    expect(seen).toEqual(['a1', 'b1', 'a2', 'b2', 'a1', 'b3', 'a2', 'b1']);
  });
  test('throws record player and bust', () => {
    const cfg = single(['A', 'B'], { options: { ...x01.defaults(), start: 301 } });
    // A: 180 -> 121, B: miss, A: T20 T20 (残り1) T20 -> bust
    const s = run(cfg, [T20, T20, T20, NEXT, MISS, NEXT, T20, T20, T20]);
    const last = s.throws.slice(-3);
    expect(last.map((t) => t.bust)).toEqual([true, true, true]);
    expect(last.map((t) => t.player.name)).toEqual(['A', 'A', 'A']);
    expect(s.throws[3]).toMatchObject({ side: 1, round: 1, idx: 0, bust: false });
    expect(s.lastTurn?.bust).toBe(true);
    expect(s.turnComplete).toBe(true);
    expect(remaining(s)).toEqual([121, 301]);
  });
});

describe('cricket summary', () => {
  test('lastTurn carries closedBefore and marks; throws carry marks', () => {
    const cfg: MatchConfig = { ...single(['A', 'B']), gameId: 'cricket', options: { maxRounds: 20 } };
    const s = run(cfg, [T20, NEXT, MISS, NEXT, D(dart('T', 20)), D(dart('T', 19)), D(dart('S', 3))]);
    expect(s.lastTurn).toMatchObject({ closedBefore: [20], marks: 6 });
    expect(s.throws.slice(-3).map((t) => t.marks)).toEqual([3, 3, 0]);
  });
});

describe('replay', () => {
  const cfg = single(['A', 'B'], { options: { ...x01.defaults(), start: 301 }, legsToWin: 2 });
  // 0-3: A 180 / 4-5: B miss / 6-8: A T20 T20 T20 -> bust (index 8) / 9-11: next, B miss, next
  // 12-14: A T20 T20 1 checkout (index 14) / 15: next (leg 2) / 16: B T20
  const events: MatchEvent[] = [
    T20, T20, T20, NEXT, MISS, NEXT, T20, T20, T20, NEXT, MISS, NEXT,
    T20, T20, D(dart('S', 1)), NEXT, T20,
  ];

  test('replay is deterministic', () => {
    expect(replay(cfg, events)).toEqual(replay(cfg, events));
  });
  test('undo across turn, bust and leg boundaries', () => {
    // n = 適用イベント数。ターン切替直後(4)・bust直後(9)・上がり直後(15)・レグ切替直後(16)
    for (const n of [4, 9, 15, 16]) {
      const before = events.slice(0, n - 1).reduce(apply, newMatch(cfg));
      expect(replay(cfg, events.slice(0, n - 1))).toEqual(before);
    }
    const afterBust = replay(cfg, events.slice(0, 9));
    expect(afterBust.lastTurn?.bust).toBe(true);
    const undoneBust = replay(cfg, events.slice(0, 8));
    expect(remaining(undoneBust)).toEqual([1, 301]);
    expect(undoneBust.turnComplete).toBe(false);
    expect(undoneBust.turnDarts).toEqual([dart('T', 20), dart('T', 20)]);
    expect(undoneBust.throws.every((t) => !t.bust)).toBe(true);

    const legBack = replay(cfg, events.slice(0, 16 - 1));
    expect(legBack.legOver).toBe(true);
    expect(legBack.leg).toBe(0);
    const checkoutBack = replay(cfg, events.slice(0, 14));
    expect(checkoutBack.legOver).toBe(false);
    expect(remaining(checkoutBack)).toEqual([1, 301]);
  });
});
