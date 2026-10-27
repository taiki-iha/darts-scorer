import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import type { Dart } from '../core/types';
import { cricket, CRICKET_TARGETS, marksOf, type CricketState } from './cricket';

const o = cricket.defaults();
function turn(s: CricketState, side: number, darts: Dart[]) {
  s = cricket.startTurn(s, side);
  let r = { state: s } as ReturnType<typeof cricket.throwDart>;
  for (const d of darts) r = cricket.throwDart(r.state, o, side, d);
  return r;
}
const closedAll = (s: CricketState, side: number): CricketState => ({
  ...s,
  marks: s.marks.map((m, i) => (i === side ? Object.fromEntries(CRICKET_TARGETS.map((t) => [t, 3])) : m)),
});

describe('cricket', () => {
  test('defaults to 20 rounds', () => {
    expect(cricket.maxRounds(o)).toBe(20);
  });
  test('marksOf', () => {
    expect(marksOf(dart('T', 20))).toBe(3);
    expect(marksOf(dart('S', 14))).toBe(0);
    expect(marksOf(dart('SB'))).toBe(1);
    expect(marksOf(dart('DB'))).toBe(2);
    expect(marksOf(dart('MISS'))).toBe(0);
  });
  test('triple opens, next triple scores while opponent is open', () => {
    const r = turn(cricket.init(o, 2), 0, [dart('T', 20), dart('T', 20)]);
    expect(r.state.marks[0][20]).toBe(6);
    expect(r.state.score).toEqual([60, 0]);
    expect(r.state.turnMarks).toBe(6);
  });
  test('no points when opponent closed too', () => {
    let s = turn(cricket.init(o, 2), 1, [dart('T', 20)]).state;
    s = turn(s, 0, [dart('T', 20), dart('T', 20)]).state;
    expect(s.score).toEqual([0, 0]);
    expect(s.turnMarks).toBe(3);
  });
  test('non-target scores nothing', () => {
    const r = turn(cricket.init(o, 2), 0, [dart('S', 14)]);
    expect(r.state.score).toEqual([0, 0]);
    expect(r.state.turnMarks).toBe(0);
  });
  test('bull marks and points', () => {
    const r = turn(cricket.init(o, 2), 0, [dart('DB'), dart('DB')]);
    expect(r.state.marks[0][25]).toBe(4);
    expect(r.state.score).toEqual([25, 0]);
  });
  test('turnMarks resets on startTurn', () => {
    const s = turn(cricket.init(o, 2), 0, [dart('T', 20)]).state;
    expect(cricket.startTurn(s, 1).turnMarks).toBe(0);
  });
  test('closedAtTurnStart records closed targets', () => {
    let s = turn(cricket.init(o, 2), 0, [dart('T', 20), dart('T', 19)]).state;
    s = cricket.startTurn(s, 0);
    expect([...s.closedAtTurnStart[0]].sort()).toEqual([19, 20]);
  });
  test('win when all closed and score not behind', () => {
    let s = closedAll(cricket.init(o, 2), 0);
    s = { ...s, marks: s.marks.map((m, i) => (i === 0 ? { ...m, 15: 2 } : m)) };
    expect(turn(s, 0, [dart('S', 15)]).finished).toBe(true);
  });
  test('no win when all closed but behind on points', () => {
    let s = closedAll(cricket.init(o, 2), 0);
    s = { ...s, score: [0, 40], marks: s.marks.map((m, i) => (i === 0 ? { ...m, 15: 2 } : m)) };
    expect(turn(s, 0, [dart('S', 15)]).finished).toBeFalsy();
  });
  test('limitWinners by score then marks', () => {
    const base = cricket.init(o, 3);
    expect(cricket.limitWinners({ ...base, score: [10, 30, 30], marks: [{}, { 20: 3 }, { 20: 2 }] })).toEqual([1]);
    expect(cricket.limitWinners({ ...base, score: [10, 30, 30], marks: [{}, { 20: 3 }, { 19: 3 }] })).toEqual([1, 2]);
  });
});
