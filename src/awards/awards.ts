import { points } from '../core/dart';
import type { BullMode, Dart } from '../core/types';
import type { GameFamily } from '../games/registry';

export type AwardId =
  | 'TON80'
  | 'HIGH_TON'
  | 'LOW_TON'
  | 'HAT_TRICK'
  | 'THREE_IN_THE_BLACK'
  | 'THREE_IN_A_BED'
  | 'WHITE_HORSE'
  | 'NINE_MARKS'
  | 'EIGHT_MARKS'
  | 'SEVEN_MARKS'
  | 'SIX_MARKS'
  | 'FIVE_MARKS';

export type MinorEffect = 'BULL' | 'BUST' | 'GAME_SHOT' | 'WIN';

export const AWARD_LABEL: Record<AwardId, string> = {
  TON80: 'TON 80!',
  HIGH_TON: 'HIGH TON',
  LOW_TON: 'LOW TON',
  HAT_TRICK: 'HAT TRICK',
  THREE_IN_THE_BLACK: 'THREE IN THE BLACK',
  THREE_IN_A_BED: 'THREE IN A BED',
  WHITE_HORSE: 'WHITE HORSE',
  NINE_MARKS: '9 MARKS',
  EIGHT_MARKS: '8 MARKS',
  SEVEN_MARKS: '7 MARKS',
  SIX_MARKS: '6 MARKS',
  FIVE_MARKS: '5 MARKS',
};

/** 画面いっぱいに大きく出すアワード */
export const BIG_AWARDS: AwardId[] = ['TON80', 'HAT_TRICK', 'THREE_IN_THE_BLACK', 'WHITE_HORSE', 'NINE_MARKS', 'EIGHT_MARKS'];

const MARKS_AWARD: Record<number, AwardId> = {
  9: 'NINE_MARKS',
  8: 'EIGHT_MARKS',
  7: 'SEVEN_MARKS',
  6: 'SIX_MARKS',
  5: 'FIVE_MARKS',
};
const CRICKET_NUMS = [15, 16, 17, 18, 19, 20];

const isBull = (d: Dart) => d.ring === 'SB' || d.ring === 'DB';
const sameBed = (ds: Dart[]) => ds.every((d) => d.ring === ds[0].ring && d.num === ds[0].num) && !isBull(ds[0]) && ds[0].ring !== 'MISS';

export function detectAward(
  family: GameFamily,
  darts: Dart[],
  ctx: { bust: boolean; bull: BullMode; closedBefore?: number[]; marks?: number },
): AwardId | null {
  if (ctx.bust || darts.length !== 3) return null;
  const blacks = darts.every((d) => d.ring === 'DB');
  const bulls = darts.every(isBull);

  if (family === 'cricket') {
    const closed = ctx.closedBefore ?? [];
    const triples = darts.filter((d) => d.ring === 'T' && CRICKET_NUMS.includes(d.num) && !closed.includes(d.num));
    if (triples.length === 3 && new Set(triples.map((d) => d.num)).size === 3) return 'WHITE_HORSE';
    if (blacks) return 'THREE_IN_THE_BLACK';
    if (bulls) return 'HAT_TRICK';
    const m = ctx.marks ?? 0;
    if (MARKS_AWARD[m]) return MARKS_AWARD[m];
    if (sameBed(darts) && CRICKET_NUMS.includes(darts[0].num)) return 'THREE_IN_A_BED';
    return null;
  }

  // countup は常にファット
  const bull = family === 'countup' ? 'fat' : ctx.bull;
  const total = darts.reduce((a, d) => a + points(d, bull), 0);
  if (darts.every((d) => d.ring === 'T' && d.num === 20)) return 'TON80';
  if (blacks) return 'THREE_IN_THE_BLACK';
  if (bulls) return 'HAT_TRICK';
  if (sameBed(darts)) return 'THREE_IN_A_BED';
  if (total >= 151) return 'HIGH_TON';
  if (total >= 100) return 'LOW_TON';
  return null;
}
