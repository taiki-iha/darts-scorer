import { multiplier } from '../core/dart';
import type { Dart } from '../core/types';
import type { CricketOptions, GameRule } from './types';

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;

export interface CricketState {
  /** サイドごと・ターゲットごとのマーク数（3超も保持） */
  marks: Record<number, number>[];
  score: number[];
  /** このターンの有効マーク数（クローズに使った分＋加点した分） */
  turnMarks: number;
  /** ターン開始時に各サイドがクローズ済みだったターゲット（JSON化・比較のため配列） */
  closedAtTurnStart: number[][];
}

const isTarget = (n: number) => (CRICKET_TARGETS as readonly number[]).includes(n);

export function marksOf(d: Dart): number {
  if (d.ring === 'MISS' || !isTarget(d.num)) return 0;
  return multiplier(d);
}

const get = (m: Record<number, number>, t: number) => m[t] ?? 0;
const closedTargets = (m: Record<number, number>) => CRICKET_TARGETS.filter((t) => get(m, t) >= 3);
const cappedMarks = (m: Record<number, number>) => CRICKET_TARGETS.reduce((a, t) => a + Math.min(3, get(m, t)), 0);

export const cricket: GameRule<CricketState, CricketOptions> = {
  id: 'cricket',
  defaults: () => ({ maxRounds: 20 }),
  maxRounds: (o) => o.maxRounds,
  init: (_o, sides) => ({
    marks: Array.from({ length: sides }, () => ({})),
    score: Array(sides).fill(0),
    turnMarks: 0,
    closedAtTurnStart: Array.from({ length: sides }, () => []),
  }),
  startTurn: (s, side) => ({
    ...s,
    turnMarks: 0,
    closedAtTurnStart: s.closedAtTurnStart.map((c, i) => (i === side ? [...closedTargets(s.marks[side])] : c)),
  }),
  throwDart(s, _o, side, d) {
    const m = marksOf(d);
    if (m === 0) return { state: s };
    const t = d.num;
    const cur = get(s.marks[side], t);
    const closing = Math.max(0, Math.min(3, cur + m) - cur);
    const extra = m - closing;
    const othersOpen = s.marks.some((mk, i) => i !== side && get(mk, t) < 3);
    const scoring = othersOpen ? extra : 0;

    const marks = s.marks.map((mk, i) => (i === side ? { ...mk, [t]: cur + m } : mk));
    const score = s.score.map((v, i) => (i === side ? v + scoring * (t === 25 ? 25 : t) : v));
    const state: CricketState = { ...s, marks, score, turnMarks: s.turnMarks + closing + scoring };

    const allClosed = closedTargets(marks[side]).length === CRICKET_TARGETS.length;
    const ahead = score.every((v, i) => i === side || score[side] >= v);
    return allClosed && ahead ? { state, finished: true } : { state };
  },
  limitWinners(s) {
    const top = Math.max(...s.score);
    const bySc = s.score.flatMap((v, i) => (v === top ? [i] : []));
    const mk = bySc.map((i) => cappedMarks(s.marks[i]));
    const topMk = Math.max(...mk);
    return bySc.filter((_, j) => mk[j] === topMk);
  },
};
