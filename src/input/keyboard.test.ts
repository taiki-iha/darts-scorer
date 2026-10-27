import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import { DIGIT_WAIT_MS, flush, initialKeyState, onKey, type KeyAction, type KeyState } from './keyboard';

/** キー列を順に流し、出てきたアクションを全部返す。[key, shift?, at?] */
function run(keys: Array<string | [string, boolean?, number?]>, end?: number): KeyAction[] {
  let s: KeyState = initialKeyState;
  const out: KeyAction[] = [];
  let now = 0;
  for (const k of keys) {
    const [key, shift, at] = typeof k === 'string' ? [k, false, undefined] : k;
    now = at ?? now + 10;
    const r = onKey(s, key, !!shift, now);
    s = r.state;
    out.push(...r.actions);
  }
  if (end !== undefined) out.push(...flush(s, end).actions);
  return out;
}
const d = (x: ReturnType<typeof dart>): KeyAction => ({ kind: 'dart', dart: x });

describe('keyboard', () => {
  test('space is miss', () => {
    expect(run([' '])).toEqual([d(dart('MISS'))]);
  });
  test('bulls', () => {
    expect(run(['b'])).toEqual([d(dart('SB'))]);
    expect(run([['B', true]])).toEqual([d(dart('DB'))]);
    expect(run(['d', 'b'])).toEqual([d(dart('DB'))]);
  });
  test('modifiers with two-digit numbers', () => {
    expect(run(['t', '2', '0'])).toEqual([d(dart('T', 20))]);
    expect(run(['d', '1', '6'])).toEqual([d(dart('D', 16))]);
  });
  test('3-9 confirm immediately', () => {
    expect(run(['5'])).toEqual([d(dart('S', 5))]);
  });
  test('pending 1 is confirmed by flush after wait', () => {
    expect(run(['1'], DIGIT_WAIT_MS + 10)).toEqual([d(dart('S', 1))]);
  });
  test('flush before wait keeps pending', () => {
    expect(run(['1'], 100)).toEqual([]);
  });
  test('2 followed by non-zero is two darts', () => {
    expect(run(['2', '5'])).toEqual([d(dart('S', 2)), d(dart('S', 5))]);
  });
  test('expired pending is confirmed before next digit', () => {
    expect(run([['1', false, 0], ['5', false, 700]])).toEqual([d(dart('S', 1)), d(dart('S', 5))]);
  });
  test('modifier resets after one dart', () => {
    expect(run(['t', '5', '5'])).toEqual([d(dart('T', 5)), d(dart('S', 5))]);
  });
  test('pending digit is confirmed before bull or miss', () => {
    expect(run(['1', 'b'])).toEqual([d(dart('S', 1)), d(dart('SB'))]);
    expect(run(['2', ' '])).toEqual([d(dart('S', 2)), d(dart('MISS'))]);
  });
  test('escape clears modifier and pending', () => {
    expect(run(['t', '1', 'Escape', '5'])).toEqual([{ kind: 'escape' }, d(dart('S', 5))]);
  });
  test('enter confirms pending then next', () => {
    expect(run(['1', 'Enter'])).toEqual([d(dart('S', 1)), { kind: 'next' }]);
    expect(run(['Enter'])).toEqual([{ kind: 'next' }]);
  });
  test('backspace clears pending, otherwise undo', () => {
    expect(run(['1', 'Backspace'])).toEqual([]);
    expect(run(['t', 'Backspace', '5'])).toEqual([d(dart('S', 5))]);
    expect(run(['Backspace'])).toEqual([{ kind: 'undo' }]);
  });
});
