import { points } from '../core/dart';
import type { CountUpOptions, GameRule } from './types';

export interface CountUpState {
  total: number[];
}

export const countup: GameRule<CountUpState, CountUpOptions> = {
  id: 'countup',
  defaults: () => ({ rounds: 8 }),
  maxRounds: (o) => o.rounds,
  init: (_o, sides) => ({ total: Array(sides).fill(0) }),
  startTurn: (s) => s,
  throwDart: (s, _o, side, d) => ({
    state: { total: s.total.map((v, i) => (i === side ? v + points(d, 'fat') : v)) },
  }),
  limitWinners(s) {
    const top = Math.max(...s.total);
    return s.total.flatMap((v, i) => (v === top ? [i] : []));
  },
};
