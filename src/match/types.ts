import type { Dart } from '../core/types';
import type { GameId, GameOptions } from '../games/types';

/** ゲストは playerId = null */
export interface PlayerRef {
  playerId: string | null;
  name: string;
}
/** 個人戦はメンバー1人のサイド */
export interface SideConfig {
  name: string;
  members: PlayerRef[];
}
export interface MatchConfig {
  gameId: GameId;
  options: GameOptions;
  mode: 'single' | 'team';
  sides: SideConfig[];
  legsToWin: number;
}
export type MatchEvent = { t: 'dart'; d: Dart } | { t: 'next' };

export interface ThrowRecord {
  leg: number;
  round: number;
  side: number;
  player: PlayerRef;
  idx: 0 | 1 | 2;
  dart: Dart;
  bust: boolean;
  /** クリケットのみ: この1投の有効マーク数 */
  marks?: number;
  /** 01・カウントアップのみ: この1投で減った/増えた点（bust ターンは0） */
  points?: number;
}

export interface TurnSummary {
  side: number;
  player: PlayerRef;
  darts: Dart[];
  bust: boolean;
  finished: boolean;
  /** クリケットのみ（CricketState から engine が詰める） */
  closedBefore?: number[];
  marks?: number;
}

export interface MatchState {
  config: MatchConfig;
  leg: number;
  legWins: number[];
  legStarter: number;
  /** 1始まり */
  round: number;
  /** このレグの投げ順（サイド番号） */
  order: number[];
  turnPos: number;
  /** 各サイドで次に投げるメンバー */
  memberPos: number[];
  turnDarts: Dart[];
  /** 3投 / bust / 上がり / 'next' で true。'next' 待ち */
  turnComplete: boolean;
  legOver: boolean;
  legWinners: number[] | null;
  matchOver: boolean;
  matchWinner: number | null;
  game: unknown;
  throws: ThrowRecord[];
  /** 演出判定用（直前に完了したターン） */
  lastTurn: TurnSummary | null;
  /** 完了したターンの履歴（全レグ）。成績のアワード集計に使う */
  turns: TurnSummary[];
}
