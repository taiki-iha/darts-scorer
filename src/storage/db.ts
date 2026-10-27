import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BullMode } from '../core/types';
import type { MatchConfig, MatchEvent } from '../match/types';

export interface Player {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}
export interface MatchRecord {
  id: string;
  startedAt: number;
  finishedAt: number;
  config: MatchConfig;
  events: MatchEvent[];
  legWins: number[];
  winner: number | null;
}
export interface CurrentMatch {
  id: string;
  startedAt: number;
  config: MatchConfig;
  events: MatchEvent[];
}
export interface Settings {
  sfx: boolean;
  volume: number;
  effects: 'full' | 'lite' | 'off';
  autoAdvance: boolean;
  defaultBull: BullMode;
}
export const DEFAULT_SETTINGS: Settings = { sfx: true, volume: 0.7, effects: 'full', autoAdvance: true, defaultBull: 'fat' };

export interface ExportData {
  app: 'darts-scorer';
  version: 1;
  exportedAt: number;
  players: Player[];
  matches: MatchRecord[];
  settings: Settings;
}

interface Schema extends DBSchema {
  players: { key: string; value: Player };
  matches: { key: string; value: MatchRecord; indexes: { finishedAt: number } };
  kv: { key: string; value: unknown };
}

export interface Db {
  listPlayers(): Promise<Player[]>;
  putPlayer(p: Player): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  listMatches(): Promise<MatchRecord[]>;
  putMatch(m: MatchRecord): Promise<void>;
  getCurrent(): Promise<CurrentMatch | null>;
  setCurrent(c: CurrentMatch | null): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(s: Settings): Promise<void>;
  exportAll(): Promise<ExportData>;
  /** 形式不正なら Error('invalid file')。成功時は全置換 */
  importAll(d: unknown): Promise<void>;
  clearAll(): Promise<void>;
}

function isExportData(d: unknown): d is ExportData {
  if (!d || typeof d !== 'object') return false;
  const x = d as Record<string, unknown>;
  return (
    x.app === 'darts-scorer' &&
    x.version === 1 &&
    Array.isArray(x.players) &&
    Array.isArray(x.matches) &&
    !!x.settings &&
    typeof x.settings === 'object'
  );
}

export async function openDb(name = 'darts-scorer'): Promise<Db> {
  const idb: IDBPDatabase<Schema> = await openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('players', { keyPath: 'id' });
      db.createObjectStore('matches', { keyPath: 'id' }).createIndex('finishedAt', 'finishedAt');
      db.createObjectStore('kv');
    },
  });

  const db: Db = {
    listPlayers: () => idb.getAll('players'),
    putPlayer: async (p) => void (await idb.put('players', p)),
    deletePlayer: (id) => idb.delete('players', id),
    listMatches: async () => (await idb.getAllFromIndex('matches', 'finishedAt')).reverse(),
    putMatch: async (m) => void (await idb.put('matches', m)),
    getCurrent: async () => ((await idb.get('kv', 'current')) as CurrentMatch | undefined) ?? null,
    setCurrent: async (c) => {
      if (c) await idb.put('kv', c, 'current');
      else await idb.delete('kv', 'current');
    },
    getSettings: async () => ({ ...DEFAULT_SETTINGS, ...((await idb.get('kv', 'settings')) as Partial<Settings> | undefined) }),
    setSettings: async (s) => void (await idb.put('kv', s, 'settings')),
    exportAll: async () => ({
      app: 'darts-scorer',
      version: 1,
      exportedAt: Date.now(),
      players: await db.listPlayers(),
      matches: await db.listMatches(),
      settings: await db.getSettings(),
    }),
    async importAll(d) {
      if (!isExportData(d)) throw new Error('invalid file');
      const tx = idb.transaction(['players', 'matches', 'kv'], 'readwrite');
      await Promise.all([tx.objectStore('players').clear(), tx.objectStore('matches').clear(), tx.objectStore('kv').clear()]);
      await Promise.all([
        ...d.players.map((p) => tx.objectStore('players').put(p)),
        ...d.matches.map((m) => tx.objectStore('matches').put(m)),
        tx.objectStore('kv').put({ ...DEFAULT_SETTINGS, ...d.settings }, 'settings'),
      ]);
      await tx.done;
    },
    async clearAll() {
      const tx = idb.transaction(['players', 'matches', 'kv'], 'readwrite');
      await Promise.all([tx.objectStore('players').clear(), tx.objectStore('matches').clear(), tx.objectStore('kv').clear()]);
      await tx.done;
    },
  };
  return db;
}
