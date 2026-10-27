import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import { AWARD_LABEL, detectAward } from './awards';

const T = (n: number) => dart('T', n);
const S = (n: number) => dart('S', n);
const ctx = { bust: false, bull: 'fat' as const };

describe('x01 / count-up awards', () => {
  test('TON 80', () => {
    expect(detectAward('x01', [T(20), T(20), T(20)], ctx)).toBe('TON80');
  });
  test('HIGH TON', () => {
    expect(detectAward('x01', [T(20), T(20), T(19)], ctx)).toBe('HIGH_TON');
    expect(detectAward('countup', [T(20), T(19), T(17)], ctx)).toBe('HIGH_TON');
  });
  test('LOW TON boundaries', () => {
    expect(detectAward('x01', [T(20), S(20), S(20)], ctx)).toBe('LOW_TON');
    expect(detectAward('x01', [T(20), S(20), S(19)], ctx)).toBeNull();
    expect(detectAward('x01', [T(20), T(20), T(11)], ctx)).toBe('HIGH_TON');
    expect(detectAward('x01', [T(20), T(20), dart('MISS')], ctx)).toBe('LOW_TON');
  });
  test('THREE IN A BED', () => {
    expect(detectAward('x01', [S(20), S(20), S(20)], ctx)).toBe('THREE_IN_A_BED');
    expect(detectAward('x01', [T(19), T(19), T(19)], ctx)).toBe('THREE_IN_A_BED');
  });
  test('HAT TRICK beats LOW TON', () => {
    expect(detectAward('countup', [dart('SB'), dart('SB'), dart('DB')], ctx)).toBe('HAT_TRICK');
  });
  test('THREE IN THE BLACK', () => {
    expect(detectAward('x01', [dart('DB'), dart('DB'), dart('DB')], ctx)).toBe('THREE_IN_THE_BLACK');
  });
  test('separate bull hat trick still counts', () => {
    expect(detectAward('x01', [dart('SB'), dart('SB'), dart('SB')], { ...ctx, bull: 'separate' })).toBe('HAT_TRICK');
  });
  test('no award on bust or short turn', () => {
    expect(detectAward('x01', [T(20), T(20), T(20)], { ...ctx, bust: true })).toBeNull();
    expect(detectAward('x01', [T(20), T(20)], ctx)).toBeNull();
  });
});

describe('cricket awards', () => {
  test('WHITE HORSE', () => {
    expect(detectAward('cricket', [T(20), T(19), T(18)], { ...ctx, closedBefore: [], marks: 9 })).toBe('WHITE_HORSE');
  });
  test('not white horse when a number was closed; 9 marks instead', () => {
    expect(detectAward('cricket', [T(20), T(19), T(18)], { ...ctx, closedBefore: [20], marks: 9 })).toBe('NINE_MARKS');
  });
  test('same triple three times is not white horse', () => {
    expect(detectAward('cricket', [T(20), T(20), T(20)], { ...ctx, closedBefore: [], marks: 9 })).toBe('NINE_MARKS');
  });
  test('marks awards 5-8', () => {
    expect(detectAward('cricket', [T(20), D16(), S(15)], { ...ctx, closedBefore: [], marks: 6 })).toBe('SIX_MARKS');
    expect(detectAward('cricket', [T(20), dart('S', 19), dart('S', 18)], { ...ctx, closedBefore: [], marks: 5 })).toBe('FIVE_MARKS');
    expect(detectAward('cricket', [T(20), dart('S', 19), dart('MISS')], { ...ctx, closedBefore: [], marks: 4 })).toBeNull();
  });
  test('cricket hat trick', () => {
    expect(detectAward('cricket', [dart('SB'), dart('DB'), dart('SB')], { ...ctx, closedBefore: [], marks: 4 })).toBe('HAT_TRICK');
  });
  test('three in a bed only on cricket numbers', () => {
    expect(detectAward('cricket', [S(15), S(15), S(15)], { ...ctx, closedBefore: [], marks: 3 })).toBe('THREE_IN_A_BED');
    expect(detectAward('cricket', [S(3), S(3), S(3)], { ...ctx, closedBefore: [], marks: 0 })).toBeNull();
  });
});

test('labels', () => {
  expect(AWARD_LABEL.TON80).toBe('TON 80!');
  expect(AWARD_LABEL.NINE_MARKS).toBe('9 MARKS');
});

function D16() {
  return dart('D', 16);
}
