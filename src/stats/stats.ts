import { detectAward, type AwardId } from '../awards/awards';
import { GAMES } from '../games/registry';
import type { X01Options } from '../games/types';
import { replay } from '../match/engine';
import type { MatchConfig } from '../match/types';
import type { MatchRecord } from '../storage/db';

/** 'x01-501' 'x01-301' … / 'cricket' / 'countup'。01 は start ごとに分ける */
export type StatKey = string;

export interface GamePoint {
  matchId: string;
  date: number;
  value: number;
  won: boolean;
}
export interface GameStats {
  key: StatKey;
  label: string;
  metric: 'PPD' | 'MPR' | 'SCORE';
  points: GamePoint[];
  avg: number;
  max: number;
  count: number;
  winRate: number | null;
}
export interface PlayerStats {
  playerId: string;
  games: GameStats[];
  awards: Partial<Record<AwardId, number>>;
}

export function statKeyOf(c: MatchConfig): StatKey {
  if (c.gameId === 'x01') return `x01-${(c.options as X01Options).start}`;
  return c.gameId;
}

function labelOf(c: MatchConfig): string {
  if (c.gameId === 'x01') return String((c.options as X01Options).start);
  return GAMES[c.gameId].name;
}

const METRIC = { x01: 'PPD', cricket: 'MPR', countup: 'SCORE' } as const;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function playerStats(playerId: string, matches: MatchRecord[]): PlayerStats {
  const byKey = new Map<StatKey, { label: string; metric: GameStats['metric']; points: GamePoint[]; multi: boolean[] }>();
  const awards: Partial<Record<AwardId, number>> = {};

  for (const m of [...matches].sort((a, b) => a.finishedAt - b.finishedAt)) {
    const s = replay(m.config, m.events);
    const mine = s.throws.filter((t) => t.player.playerId === playerId);
    if (mine.length === 0) continue;

    const family = GAMES[m.config.gameId].family;
    let value: number;
    if (family === 'cricket') value = round2((mine.reduce((a, t) => a + (t.marks ?? 0), 0) * 3) / mine.length);
    else {
      const total = mine.reduce((a, t) => a + (t.points ?? 0), 0);
      value = family === 'x01' ? round2(total / mine.length) : total;
    }

    const multi = m.config.sides.length >= 2;
    const side = mine[0].side;
    const key = statKeyOf(m.config);
    if (!byKey.has(key)) byKey.set(key, { label: labelOf(m.config), metric: METRIC[family], points: [], multi: [] });
    const g = byKey.get(key)!;
    g.points.push({ matchId: m.id, date: m.finishedAt, value, won: multi && m.winner === side });
    g.multi.push(multi);

    const bull = m.config.gameId === 'x01' ? (m.config.options as X01Options).bull : 'fat';
    for (const t of s.turns) {
      if (t.player.playerId !== playerId) continue;
      const a = detectAward(family, t.darts, { bust: t.bust, bull, closedBefore: t.closedBefore, marks: t.marks });
      if (a) awards[a] = (awards[a] ?? 0) + 1;
    }
  }

  const games: GameStats[] = [...byKey.entries()].map(([key, g]) => {
    const values = g.points.map((p) => p.value);
    const multiGames = g.points.filter((_, i) => g.multi[i]);
    return {
      key,
      label: g.label,
      metric: g.metric,
      points: g.points,
      avg: round2(values.reduce((a, v) => a + v, 0) / values.length),
      max: Math.max(...values),
      count: values.length,
      winRate: multiGames.length ? round2(multiGames.filter((p) => p.won).length / multiGames.length) : null,
    };
  });
  return { playerId, games, awards };
}
