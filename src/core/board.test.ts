import { describe, expect, test } from 'vitest';
import { hitTest, R } from './board';
import { dart } from './dart';

const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

describe('hitTest', () => {
  test('basic positions', () => {
    expect(hitTest(0, 0)).toEqual(dart('DB'));
    expect(hitTest(0, -0.06)).toEqual(dart('SB'));
    expect(hitTest(0, -0.6)).toEqual(dart('T', 20));
    expect(hitTest(0.6, 0)).toEqual(dart('T', 6));
    expect(hitTest(0, 0.6)).toEqual(dart('T', 3));
    expect(hitTest(-0.6, 0)).toEqual(dart('T', 11));
    expect(hitTest(0, -0.97)).toEqual(dart('D', 20));
    expect(hitTest(0, -0.3)).toEqual(dart('S', 20));
    expect(hitTest(0, -0.8)).toEqual(dart('S', 20));
    expect(hitTest(0, -1.01)).toEqual(dart('MISS'));
  });

  test('ring boundaries', () => {
    expect(hitTest(...polar(R.TIN - 1e-6, 0))).toEqual(dart('S', 20));
    expect(hitTest(...polar(R.TIN, 0))).toEqual(dart('T', 20));
    expect(hitTest(...polar(R.TOUT, 0))).toEqual(dart('T', 20));
    expect(hitTest(...polar(R.TOUT + 1e-6, 0))).toEqual(dart('S', 20));
    expect(hitTest(...polar(R.DOUT, 0))).toEqual(dart('D', 20));
    expect(hitTest(...polar(R.DOUT + 1e-6, 0))).toEqual(dart('MISS'));
    expect(hitTest(...polar(R.DB, 0))).toEqual(dart('DB'));
    expect(hitTest(...polar(R.SB, 0))).toEqual(dart('SB'));
  });

  test('segment boundary between 20 and 1 goes to 1', () => {
    expect(hitTest(...polar(0.3, 9))).toEqual(dart('S', 1));
    expect(hitTest(...polar(0.3, 8.99))).toEqual(dart('S', 20));
    expect(hitTest(...polar(0.3, 351))).toEqual(dart('S', 20));
  });
});
