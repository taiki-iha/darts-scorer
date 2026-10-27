import type { Dart } from '../core/types';
import type { CurrentMatch, MatchRecord } from '../storage/db';
import { replay } from './engine';
import type { MatchConfig, MatchEvent } from './types';

// 画面の操作をイベント列の更新に変換する純粋関数。
// 1回のキー入力で複数の操作が来ても、前の結果を次に渡せば取りこぼさない。

const NEXT: MatchEvent = { t: 'next' };

/** 1投を足す。手番終了後なら次の手番の1投目にする。レグ・試合終了後は無視 */
export function addDart(config: MatchConfig, events: MatchEvent[], d: Dart): MatchEvent[] {
  const s = replay(config, events);
  if (s.matchOver || s.legOver) return events;
  const base = s.turnComplete ? [...events, NEXT] : events;
  return [...base, { t: 'dart', d }];
}

/** 次へ（手番を終える／次のレグへ）。試合終了後は無視 */
export function addNext(config: MatchConfig, events: MatchEvent[]): MatchEvent[] {
  return replay(config, events).matchOver ? events : [...events, NEXT];
}

/** 1投戻す。末尾の 'next' は投擲ではないので一緒に取り除く */
export function undoLast(events: MatchEvent[]): MatchEvent[] {
  const next = [...events];
  while (next.length && next[next.length - 1].t === 'next') next.pop();
  next.pop();
  return next;
}

/** 終わった試合なら保存用の記録を作る。終わっていなければ null */
export function recordFromCurrent(current: CurrentMatch, finishedAt: number): MatchRecord | null {
  const s = replay(current.config, current.events);
  if (!s.matchOver) return null;
  return {
    id: current.id,
    startedAt: current.startedAt,
    finishedAt,
    config: current.config,
    events: current.events,
    legWins: s.legWins,
    winner: s.matchWinner,
  };
}
