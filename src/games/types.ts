import type { BullMode, Dart } from '../core/types';

export type GameId = 'x01' | 'cricket' | 'countup';
export type InOut = 'open' | 'double' | 'master';

export interface X01Options {
  start: 301 | 501 | 701 | 901 | 1101 | 1501;
  in: InOut;
  out: InOut;
  bull: BullMode;
  maxRounds: number;
}
export interface CricketOptions {
  maxRounds: number;
}
export interface CountUpOptions {
  rounds: number;
}
export type GameOptions = X01Options | CricketOptions | CountUpOptions;

export interface ThrowResult<S> {
  state: S;
  bust?: boolean;
  finished?: boolean;
}

export interface GameRule<S, O> {
  id: GameId;
  defaults(): O;
  maxRounds(o: O): number;
  init(o: O, sides: number): S;
  /** ターン開始時のスナップショット保存など */
  startTurn(s: S, side: number): S;
  throwDart(s: S, o: O, side: number, d: Dart): ThrowResult<S>;
  /** ラウンド上限到達時の勝者（同点なら複数） */
  limitWinners(s: S): number[];
}
