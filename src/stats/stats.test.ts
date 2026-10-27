import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import type { Dart } from '../core/types';
import { x01 } from '../games/x01';
import { replay } from '../match/engine';
import type { MatchConfig, MatchEvent, PlayerRef } from '../match/types';
import type { MatchRecord } from '../storage/db';
import { playerStats, statKeyOf } from './stats';

const A: PlayerRef = { playerId: 'a', name: 'A' };
const B: PlayerRef = { playerId: 'b', name: 'B' };
const G: PlayerRef = { playerId: null, name: 'ゲスト1' };
const D = (d: Dart): MatchEvent => ({ t: 'dart', d });
const NEXT: MatchEvent = { t: 'next' };
const T20 = D(dart('T', 20));
const MISS = D(dart('MISS'));

let seq = 0;
function record(config: MatchConfig, events: MatchEvent[], finishedAt = ++seq): MatchRecord {
  const s = replay(config, events);
  return { id: `m${seq}`, startedAt: finishedAt - 1, finishedAt, config, events, legWins: s.legWins, winner: s.matchWinner };
}
const cfg = (gameId: MatchConfig['gameId'], options: MatchConfig['options'], players = [A, B]): MatchConfig => ({
  gameId,
  options,
  mode: 'single',
  sides: players.map((p) => ({ name: p.name, members: [p] })),
  legsToWin: 1,
});
/** カウントアップ 8 ラウンド。先頭プレイヤーが毎ラウンド darts を、ほかはミスを投げる */
function countupMatch(darts: Dart[], players = [A]) {
  const ev: MatchEvent[] = [];
  for (let r = 0; r < 8; r++) {
    ev.push(...darts.map(D), NEXT);
    for (let i = 1; i < players.length; i++) ev.push(MISS, NEXT);
  }
  return record(cfg('countup', { rounds: 8 }, players), ev);
}

describe('statKeyOf', () => {
  test('x01 keyed by start', () => {
    expect(statKeyOf(cfg('x01', { ...x01.defaults(), start: 301 }))).toBe('x01-301');
    expect(statKeyOf(cfg('x01', { ...x01.defaults(), start: 501 }))).toBe('x01-501');
    expect(statKeyOf(cfg('cricket', { maxRounds: 20 }))).toBe('cricket');
    expect(statKeyOf(cfg('countup', { rounds: 8 }))).toBe('countup');
  });
});

describe('playerStats', () => {
  test('x01 PPD counts bust darts with zero points', () => {
    // A: R1 T20 / R2 T20 / R3 T20 T20 T20 → 5投で300点 = PPD 60
    const ev = [T20, NEXT, MISS, NEXT, T20, NEXT, MISS, NEXT, T20, T20, T20];
    const m = record(cfg('x01', { ...x01.defaults(), start: 301 }), ev);
    const st = playerStats('a', [m]).games[0];
    expect(st.key).toBe('x01-301');
    expect(st.metric).toBe('PPD');
    expect(st.points[0].value).toBe(60);
    // bust を含む試合: A 180 → 121、次のターン T20 T20 T20 で bust
    const ev2 = [T20, T20, T20, NEXT, MISS, NEXT, T20, T20, T20];
    const m2 = record(cfg('x01', { ...x01.defaults(), start: 301 }), ev2);
    // A: 180 + bust(0) / 6投 = 30
    expect(playerStats('a', [m2]).games[0].points[0].value).toBe(30);
  });

  test('PPD rounds to 2 decimals', () => {
    // A: 60 / 60 / 0 を 3投ずつ = 120 / 9 = 13.33
    const ev = [T20, MISS, MISS, NEXT, MISS, NEXT, T20, MISS, MISS, NEXT, MISS, NEXT, MISS, MISS, MISS, NEXT];
    const m = record(cfg('x01', { ...x01.defaults(), start: 501 }), ev);
    expect(playerStats('a', [m]).games[0].points[0].value).toBe(13.33);
  });

  test('count-up avg, max, count', () => {
    const a = countupMatch([dart('S', 20), dart('S', 20), dart('S', 2)]); // 42 × 8 = 336
    const b = countupMatch([dart('S', 20), dart('S', 20), dart('S', 20)]); // 60 × 8 = 480
    const st = playerStats('a', [a, b]).games.find((g) => g.key === 'countup')!;
    expect(st.metric).toBe('SCORE');
    expect(st.points.map((p) => p.value)).toEqual([336, 480]);
    expect(st.count).toBe(2);
    expect(st.avg).toBe(408);
    expect(st.max).toBe(480);
  });

  test('points are in date order regardless of input order', () => {
    const a = countupMatch([dart('S', 1), dart('MISS'), dart('MISS')]);
    const b = countupMatch([dart('S', 2), dart('MISS'), dart('MISS')]);
    const st = playerStats('a', [b, a]).games[0];
    expect(st.points.map((p) => p.value)).toEqual([8, 16]);
  });

  test('cricket MPR', () => {
    // A: T20 T19 S3 (6 marks) / B miss / A MISS×3 → 6 marks / 6 darts = 3.00
    const ev = [T20, D(dart('T', 19)), D(dart('S', 3)), NEXT, MISS, NEXT, MISS, MISS, MISS, NEXT];
    const st = playerStats('a', [record(cfg('cricket', { maxRounds: 20 }), ev)]).games[0];
    expect(st.metric).toBe('MPR');
    expect(st.points[0].value).toBe(3);
  });

  test('guest-only and other players matches are ignored', () => {
    const m = countupMatch([dart('S', 1), dart('MISS'), dart('MISS')], [G]);
    expect(playerStats('a', [m]).games).toEqual([]);
  });

  test('winRate excludes solo matches', () => {
    const solo = countupMatch([dart('S', 1), dart('MISS'), dart('MISS')], [A]);
    const vs = countupMatch([dart('S', 1), dart('MISS'), dart('MISS')], [A, B]);
    const st = playerStats('a', [solo, vs]).games[0];
    expect(st.count).toBe(2);
    expect(st.winRate).toBe(1);
    expect(st.points.map((p) => p.won)).toEqual([false, true]);
    expect(playerStats('a', [solo]).games[0].winRate).toBeNull();
  });

  test('team match counts only own darts', () => {
    const team: MatchConfig = {
      gameId: 'countup',
      options: { rounds: 1 },
      mode: 'team',
      sides: [{ name: 'T1', members: [A, B] }, { name: 'T2', members: [G] }],
      legsToWin: 1,
    };
    const m = record(team, [T20, NEXT, MISS, NEXT]);
    expect(playerStats('a', [m]).games[0].points[0].value).toBe(60);
    expect(playerStats('b', [m]).games).toEqual([]);
  });

  test('awards are counted per turn', () => {
    const m = countupMatch([dart('T', 20), dart('T', 20), dart('T', 20)]);
    expect(playerStats('a', [m]).awards.TON80).toBe(8);
  });
});
