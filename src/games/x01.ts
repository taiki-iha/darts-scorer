import { label, points } from '../core/dart';
import type { BullMode, Dart } from '../core/types';
import type { GameRule, InOut, X01Options } from './types';

export interface X01State {
  remaining: number[];
  opened: boolean[];
  turnStart: number[];
  turnStartOpened: boolean[];
}

export function defaultRoundsFor(start: X01Options['start']): number {
  if (start === 301) return 10;
  if (start === 501) return 15;
  return 20;
}

/** IN / OUT の条件を満たすダーツか */
function qualifies(d: Dart, mode: InOut): boolean {
  if (mode === 'open') return d.ring !== 'MISS';
  if (mode === 'double') return d.ring === 'D' || d.ring === 'DB';
  return d.ring === 'D' || d.ring === 'T' || d.ring === 'DB';
}

const set = <T>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));

export const x01: GameRule<X01State, X01Options> = {
  id: 'x01',
  defaults: () => ({ start: 501, in: 'open', out: 'open', bull: 'fat', maxRounds: 15 }),
  maxRounds: (o) => o.maxRounds,
  init: (o, sides) => ({
    remaining: Array(sides).fill(o.start),
    opened: Array(sides).fill(o.in === 'open'),
    turnStart: Array(sides).fill(o.start),
    turnStartOpened: Array(sides).fill(o.in === 'open'),
  }),
  startTurn: (s, side) => ({
    ...s,
    turnStart: set(s.turnStart, side, s.remaining[side]),
    turnStartOpened: set(s.turnStartOpened, side, s.opened[side]),
  }),
  throwDart(s, o, side, d) {
    let opened = s.opened[side];
    if (!opened) {
      if (!qualifies(d, o.in)) return { state: s };
      opened = true;
    }
    const rem = s.remaining[side] - points(d, o.bull);
    const bust = () => ({
      state: {
        ...s,
        remaining: set(s.remaining, side, s.turnStart[side]),
        opened: set(s.opened, side, s.turnStartOpened[side]),
      },
      bust: true,
    });
    if (rem < 0) return bust();
    if (rem === 0 && !qualifies(d, o.out)) return bust();
    if (rem === 1 && o.out !== 'open') return bust();
    const state = { ...s, remaining: set(s.remaining, side, rem), opened: set(s.opened, side, opened) };
    return rem === 0 ? { state, finished: true } : { state };
  },
  limitWinners(s) {
    const best = Math.min(...s.remaining);
    return s.remaining.flatMap((r, i) => (r === best ? [i] : []));
  },
};

// ---- 上がり目 ----

const NUMS = Array.from({ length: 20 }, (_, i) => 20 - i);
const ALL_DARTS: Dart[] = [
  ...NUMS.map((n) => ({ ring: 'T' as const, num: n })),
  { ring: 'SB', num: 25 },
  { ring: 'DB', num: 25 },
  ...NUMS.map((n) => ({ ring: 'D' as const, num: n })),
  ...NUMS.map((n) => ({ ring: 'S' as const, num: n })),
];
/** 上がりに使いやすいダブルの順 */
const PREFERRED_DOUBLES = [20, 16, 10, 8, 18, 12, 4, 6, 14, 2];

function finalRank(d: Dart, out: InOut): number {
  // open out は狙いやすさより一般的な並び（トリプル→ブル→…）で選ぶ
  if (out === 'open') return ALL_DARTS.indexOf(d);
  if (d.ring === 'D') {
    const i = PREFERRED_DOUBLES.indexOf(d.num);
    return i >= 0 ? i : 10 + (20 - d.num);
  }
  if (d.ring === 'DB') return 40;
  return 50 + ALL_DARTS.indexOf(d);
}
/** 20 のセグメント以外の準備ダーツの本数（少ないほど狙いやすい） */
const offTwenty = (ds: Dart[]) => ds.filter((d) => d.num !== 20).length;

/** maxDarts: このターンで残っている投数（1〜3） */
export function checkoutHint(remaining: number, out: InOut, bull: BullMode, maxDarts = 3): string[] | null {
  if (remaining > 170 || remaining < 1) return null;
  const finals = ALL_DARTS.filter((d) => qualifies(d, out));
  for (let n = 1; n <= Math.min(3, maxDarts); n++) {
    let best: { darts: Dart[]; key: number[] } | null = null;
    const search = (prefix: Dart[], left: number) => {
      if (prefix.length === n - 1) {
        for (const f of finals) {
          if (points(f, bull) !== left) continue;
          const darts = [...prefix, f];
          const key = [finalRank(f, out), offTwenty(prefix)];
          if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) best = { darts, key };
        }
        return;
      }
      for (const d of ALL_DARTS) {
        const p = points(d, bull);
        if (p < left) search([...prefix, d], left - p);
      }
    };
    search([], remaining);
    if (best) return (best as { darts: Dart[] }).darts.map(label);
  }
  return null;
}
