import type { Dart } from '../core/types';
import type { CricketState } from '../games/cricket';
import { GAMES } from '../games/registry';
import type { MatchConfig, MatchEvent, MatchState, PlayerRef, ThrowRecord, TurnSummary } from './types';

const ruleOf = (s: MatchState) => GAMES[s.config.gameId].rule;
const isCricket = (s: MatchState) => GAMES[s.config.gameId].family === 'cricket';
const sideCount = (s: MatchState) => s.config.sides.length;

export function currentSide(s: MatchState): number {
  return s.order[s.turnPos];
}

export function currentPlayer(s: MatchState): PlayerRef {
  const side = currentSide(s);
  const members = s.config.sides[side].members;
  return members[s.memberPos[side] % members.length];
}

/** レグを開始する。先攻は leg mod サイド数 */
function startLeg(s: MatchState, leg: number): MatchState {
  const n = sideCount(s);
  const starter = leg % n;
  const order = Array.from({ length: n }, (_, i) => (starter + i) % n);
  const rule = GAMES[s.config.gameId].rule;
  const game = rule.startTurn(rule.init(s.config.options, n), order[0]);
  return {
    ...s,
    leg,
    legStarter: starter,
    round: 1,
    order,
    turnPos: 0,
    memberPos: Array(n).fill(0),
    turnDarts: [],
    turnComplete: false,
    legOver: false,
    legWinners: null,
    game,
  };
}

export function newMatch(config: MatchConfig): MatchState {
  const base: MatchState = {
    config,
    leg: 0,
    legWins: Array(config.sides.length).fill(0),
    legStarter: 0,
    round: 1,
    order: [],
    turnPos: 0,
    memberPos: [],
    turnDarts: [],
    turnComplete: false,
    legOver: false,
    legWinners: null,
    matchOver: false,
    matchWinner: null,
    game: null,
    throws: [],
    lastTurn: null,
    turns: [],
  };
  return startLeg(base, 0);
}

/** レグの勝者を確定し、勝ち数と試合終了を更新する。勝者が複数（引き分け）なら誰にも付けない */
function endLeg(s: MatchState, winners: number[]): MatchState {
  const legWins = winners.length === 1 ? s.legWins.map((w, i) => (i === winners[0] ? w + 1 : w)) : s.legWins;
  const champ = legWins.findIndex((w) => w >= s.config.legsToWin);
  return {
    ...s,
    legOver: true,
    legWinners: winners,
    legWins,
    matchOver: champ >= 0,
    matchWinner: champ >= 0 ? champ : null,
  };
}

function summary(s: MatchState, bust: boolean, finished: boolean): TurnSummary {
  const sum: TurnSummary = {
    side: currentSide(s),
    player: currentPlayer(s),
    darts: s.turnDarts,
    bust,
    finished,
  };
  if (isCricket(s)) {
    const g = s.game as CricketState;
    // closedAtTurnStart はターン中は変わらない
    sum.closedBefore = g.closedAtTurnStart[sum.side];
    sum.marks = g.turnMarks;
  }
  return sum;
}

/** ターンを完了させる。最終ラウンドの最後の手番ならラウンド上限で勝敗を決める */
function withTurn(s: MatchState, t: TurnSummary): MatchState {
  return { ...s, turnComplete: true, lastTurn: t, turns: [...s.turns, t] };
}

function completeTurn(s: MatchState, bust: boolean): MatchState {
  s = withTurn(s, summary(s, bust, false));
  const lastInRound = s.turnPos === s.order.length - 1;
  if (lastInRound && s.round >= ruleOf(s).maxRounds(s.config.options)) {
    return endLeg(s, ruleOf(s).limitWinners(s.game));
  }
  return s;
}

/** 01 は減った点、カウントアップは合計点を「得点」として比較できる値にする */
function scoreOf(s: MatchState, game: unknown, side: number): number {
  if (s.config.gameId === 'x01') return -(game as { remaining: number[] }).remaining[side];
  return (game as { total: number[] }).total[side];
}

function applyDart(s: MatchState, d: Dart): MatchState {
  if (s.matchOver || s.legOver || s.turnComplete) return s;
  const side = currentSide(s);
  const before = s.game;
  const r = ruleOf(s).throwDart(before, s.config.options, side, d);

  const rec: ThrowRecord = {
    leg: s.leg,
    round: s.round,
    side,
    player: currentPlayer(s),
    idx: s.turnDarts.length as 0 | 1 | 2,
    dart: d,
    bust: false,
  };
  if (isCricket(s)) rec.marks = (r.state as CricketState).turnMarks - (before as CricketState).turnMarks;
  else rec.points = scoreOf(s, r.state, side) - scoreOf(s, before, side);

  let throws = [...s.throws, rec];
  if (r.bust) {
    // このターンの投擲をすべて bust 扱いにする
    const k = s.turnDarts.length + 1;
    throws = throws.map((t, i) => (i >= throws.length - k ? { ...t, bust: true, points: 0 } : t));
  }
  let next: MatchState = { ...s, game: r.state, throws, turnDarts: [...s.turnDarts, d] };

  if (r.finished) {
    next = withTurn(next, summary(next, false, true));
    return endLeg(next, [side]);
  }
  if (r.bust || next.turnDarts.length === 3) return completeTurn(next, !!r.bust);
  return next;
}

function applyNext(s: MatchState): MatchState {
  if (s.matchOver) return s;
  if (s.legOver) return startLeg(s, s.leg + 1);
  if (!s.turnComplete) {
    s = completeTurn(s, false);
    if (s.legOver) return s;
  }
  const side = currentSide(s);
  const memberPos = s.memberPos.map((m, i) => (i === side ? m + 1 : m));
  let turnPos = s.turnPos + 1;
  let round = s.round;
  if (turnPos >= s.order.length) {
    turnPos = 0;
    round += 1;
  }
  const game = ruleOf(s).startTurn(s.game, s.order[turnPos]);
  return { ...s, memberPos, turnPos, round, game, turnDarts: [], turnComplete: false };
}

export function apply(s: MatchState, e: MatchEvent): MatchState {
  return e.t === 'dart' ? applyDart(s, e.d) : applyNext(s);
}

export function replay(config: MatchConfig, events: MatchEvent[]): MatchState {
  return events.reduce(apply, newMatch(config));
}
