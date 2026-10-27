import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { dart } from '../core/dart';
import type { MatchConfig, MatchEvent } from '../match/types';
import { DEFAULT_SETTINGS, openDb, type MatchRecord, type Player } from './db';

let n = 0;
const fresh = () => openDb(`test-${++n}`);
const player = (id: string, name = id): Player => ({ id, name, color: '#00e5ff', createdAt: 1 });
const config: MatchConfig = {
  gameId: 'countup',
  options: { rounds: 8 },
  mode: 'single',
  sides: [{ name: 'A', members: [{ playerId: 'a', name: 'A' }] }],
  legsToWin: 1,
};
const match = (id: string, finishedAt: number): MatchRecord => ({
  id,
  startedAt: finishedAt - 100,
  finishedAt,
  config,
  events: [{ t: 'dart', d: dart('T', 20) }],
  legWins: [1],
  winner: 0,
});

describe('players', () => {
  test('put, list, delete', async () => {
    const db = await fresh();
    await db.putPlayer(player('a'));
    await db.putPlayer(player('b'));
    await db.putPlayer({ ...player('a'), name: 'あ' });
    expect((await db.listPlayers()).map((p) => p.name).sort()).toEqual(['b', 'あ']);
    await db.deletePlayer('b');
    expect((await db.listPlayers()).map((p) => p.id)).toEqual(['a']);
  });
});

describe('matches', () => {
  test('listed newest first', async () => {
    const db = await fresh();
    await db.putMatch(match('m1', 1000));
    await db.putMatch(match('m3', 3000));
    await db.putMatch(match('m2', 2000));
    expect((await db.listMatches()).map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
  });
});

describe('current match', () => {
  test('current match round-trips events', async () => {
    const db = await fresh();
    expect(await db.getCurrent()).toBeNull();
    const events: MatchEvent[] = Array.from({ length: 50 }, (_, i) =>
      i % 4 === 3 ? { t: 'next' } : { t: 'dart', d: dart('S', (i % 20) + 1) },
    );
    await db.setCurrent({ id: 'c', startedAt: 5, config, events });
    expect(await db.getCurrent()).toEqual({ id: 'c', startedAt: 5, config, events });
    await db.setCurrent(null);
    expect(await db.getCurrent()).toBeNull();
  });
});

describe('settings', () => {
  test('defaults then saved', async () => {
    const db = await fresh();
    expect(await db.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ sfx: true, volume: 0.7, effects: 'full', autoAdvance: true, defaultBull: 'fat' });
    await db.setSettings({ ...DEFAULT_SETTINGS, sfx: false });
    expect((await db.getSettings()).sfx).toBe(false);
  });
});

describe('export / import', () => {
  test('export, clear, import restores everything', async () => {
    const db = await fresh();
    await db.putPlayer(player('a'));
    await db.putMatch(match('m1', 1000));
    await db.setSettings({ ...DEFAULT_SETTINGS, volume: 0.2 });
    const data = await db.exportAll();
    expect(data.app).toBe('darts-scorer');
    expect(data.version).toBe(1);

    await db.clearAll();
    expect(await db.listPlayers()).toEqual([]);
    expect(await db.listMatches()).toEqual([]);
    expect(await db.getSettings()).toEqual(DEFAULT_SETTINGS);

    await db.importAll(JSON.parse(JSON.stringify(data)));
    expect(await db.listPlayers()).toEqual([player('a')]);
    expect((await db.listMatches()).map((m) => m.id)).toEqual(['m1']);
    expect((await db.getSettings()).volume).toBe(0.2);
  });
  test('import replaces existing data', async () => {
    const db = await fresh();
    await db.putPlayer(player('old'));
    await db.importAll({ app: 'darts-scorer', version: 1, exportedAt: 0, players: [player('new')], matches: [], settings: DEFAULT_SETTINGS });
    expect((await db.listPlayers()).map((p) => p.id)).toEqual(['new']);
  });
  test('invalid file is rejected and data kept', async () => {
    const db = await fresh();
    await db.putPlayer(player('a'));
    await expect(db.importAll({ app: 'x' })).rejects.toThrow('invalid file');
    await expect(db.importAll(null)).rejects.toThrow('invalid file');
    await expect(db.importAll({ app: 'darts-scorer', version: 1, players: 'x', matches: [], settings: {} })).rejects.toThrow('invalid file');
    expect((await db.listPlayers()).map((p) => p.id)).toEqual(['a']);
  });
  test('malformed elements are rejected and existing data kept', async () => {
    const db = await fresh();
    await db.putPlayer(player('a'));
    await db.putMatch(match('m1', 1000));
    const base = { app: 'darts-scorer', version: 1, exportedAt: 0, settings: DEFAULT_SETTINGS };
    // id のないプレイヤー
    await expect(db.importAll({ ...base, players: [{ name: 'x' }], matches: [] })).rejects.toThrow('invalid file');
    // 知らないゲーム
    await expect(
      db.importAll({ ...base, players: [], matches: [{ ...match('m2', 1), config: { ...config, gameId: 'golf' } }] }),
    ).rejects.toThrow('invalid file');
    // events がない
    await expect(db.importAll({ ...base, players: [], matches: [{ ...match('m3', 1), events: undefined }] })).rejects.toThrow(
      'invalid file',
    );
    expect((await db.listPlayers()).map((p) => p.id)).toEqual(['a']);
    expect((await db.listMatches()).map((m) => m.id)).toEqual(['m1']);
  });
});
