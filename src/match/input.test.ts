import { expect, test } from 'vitest';
import { dart } from '../core/dart';
import { x01 } from '../games/x01';
import { replay } from './engine';
import { addDart, addNext, recordFromCurrent, undoLast } from './input';
import type { MatchConfig, MatchEvent } from './types';

const cfg: MatchConfig = {
  gameId: 'x01',
  options: { ...x01.defaults(), start: 301 },
  mode: 'single',
  sides: ['A', 'B'].map((n) => ({ name: n, members: [{ playerId: n, name: n }] })),
  legsToWin: 1,
};
const T20 = dart('T', 20);

test('two key actions applied in sequence keep both darts', () => {
  // キーボードの「2」「5」は S2 と S5 の2アクション。順に適用して両方残ること
  let ev: MatchEvent[] = [];
  ev = addDart(cfg, ev, dart('S', 2));
  ev = addDart(cfg, ev, dart('S', 5));
  expect(replay(cfg, ev).turnDarts).toEqual([dart('S', 2), dart('S', 5)]);
});

test('dart then next in sequence', () => {
  let ev: MatchEvent[] = [];
  ev = addDart(cfg, ev, dart('S', 1));
  ev = addNext(cfg, ev);
  const s = replay(cfg, ev);
  expect(s.lastTurn?.darts).toEqual([dart('S', 1)]);
  expect(s.turnPos).toBe(1);
});

test('dart on a completed turn starts the next turn', () => {
  const ev = addDart(cfg, [T20, T20, T20].map((d) => ({ t: 'dart', d }) as MatchEvent), dart('S', 5));
  const s = replay(cfg, ev);
  expect(s.turnPos).toBe(1);
  expect(s.turnDarts).toEqual([dart('S', 5)]);
});

test('dart after leg over is ignored', () => {
  const won: MatchEvent[] = [T20, T20, T20, null, dart('MISS'), null, T20, T20, dart('S', 1)].map((d) =>
    d ? { t: 'dart', d } : { t: 'next' },
  );
  expect(addDart(cfg, won, T20)).toBe(won);
});

test('undo removes trailing nexts and one dart', () => {
  const ev: MatchEvent[] = [{ t: 'dart', d: T20 }, { t: 'next' }];
  expect(undoLast(ev)).toEqual([]);
});

test('recordFromCurrent builds a finished match record', () => {
  const events: MatchEvent[] = [T20, T20, T20, null, dart('MISS'), null, T20, T20, dart('S', 1)].map((d) =>
    d ? { t: 'dart', d } : { t: 'next' },
  );
  const rec = recordFromCurrent({ id: 'm', startedAt: 1, config: cfg, events }, 99);
  expect(rec).toEqual({ id: 'm', startedAt: 1, finishedAt: 99, config: cfg, events, legWins: [1, 0], winner: 0 });
  expect(recordFromCurrent({ id: 'm', startedAt: 1, config: cfg, events: events.slice(0, -1) }, 99)).toBeNull();
});
