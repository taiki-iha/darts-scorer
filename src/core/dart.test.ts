import { describe, expect, test } from 'vitest';
import { dart, label, multiplier, parseLabel, points } from './dart';

describe('points', () => {
  test('numbers and multipliers', () => {
    expect(points(dart('T', 20), 'fat')).toBe(60);
    expect(points(dart('D', 16), 'fat')).toBe(32);
    expect(points(dart('S', 5), 'fat')).toBe(5);
  });
  test('bull modes', () => {
    expect(points(dart('SB'), 'fat')).toBe(50);
    expect(points(dart('SB'), 'separate')).toBe(25);
    expect(points(dart('DB'), 'separate')).toBe(50);
    expect(points(dart('DB'), 'fat')).toBe(50);
  });
  test('miss', () => {
    expect(points(dart('MISS'), 'fat')).toBe(0);
  });
});

test('multiplier', () => {
  expect(multiplier(dart('T', 1))).toBe(3);
  expect(multiplier(dart('SB'))).toBe(1);
  expect(multiplier(dart('DB'))).toBe(2);
  expect(multiplier(dart('MISS'))).toBe(0);
});

test('label', () => {
  expect(label(dart('T', 20))).toBe('T20');
  expect(label(dart('D', 16))).toBe('D16');
  expect(label(dart('S', 5))).toBe('5');
  expect(label(dart('SB'))).toBe('BULL');
  expect(label(dart('DB'))).toBe('D-BULL');
  expect(label(dart('MISS'))).toBe('MISS');
});

test('parseLabel is the inverse of label', () => {
  for (const d of [dart('T', 20), dart('D', 16), dart('S', 5), dart('SB'), dart('DB'), dart('MISS')]) {
    expect(parseLabel(label(d))).toEqual(d);
  }
  expect(parseLabel('X9')).toBeNull();
});
