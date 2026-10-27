import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { detectAward, BIG_AWARDS, type AwardId } from '../../awards/awards';
import { playSfx, unlockAudio, type SfxName } from '../../audio/sfx';
import { announce, unlockVoice } from '../../audio/voice';
import { label, parseLabel, points } from '../../core/dart';
import type { Dart } from '../../core/types';
import type { CricketState } from '../../games/cricket';
import type { CountUpState } from '../../games/countup';
import { GAMES } from '../../games/registry';
import type { X01Options } from '../../games/types';
import { checkoutHint, type X01State } from '../../games/x01';
import { DIGIT_WAIT_MS, flush, initialKeyState, onKey, type KeyAction } from '../../input/keyboard';
import { currentPlayer, currentSide, replay } from '../../match/engine';
import { addDart, addNext, recordFromCurrent, undoLast } from '../../match/input';
import type { MatchEvent, MatchState } from '../../match/types';
import type { CurrentMatch, Db, MatchRecord, Settings } from '../../storage/db';
import { AwardOverlay, type Effect } from '../components/AwardOverlay';
import { Board } from '../components/Board';
import { CricketBoard } from '../components/CricketBoard';
import { X01Board } from '../components/X01Board';

interface Props {
  db: Db;
  current: CurrentMatch;
  settings: Settings;
  onFinished: (m: MatchRecord) => void;
  onQuit: () => void;
}

const NEXT: MatchEvent = { t: 'next' };
const AUTO_ADVANCE_MS = 700;

export function gameLabel(s: MatchState): string {
  if (s.config.gameId === 'x01') return String((s.config.options as X01Options).start);
  return GAMES[s.config.gameId].name;
}

export function sideScores(s: MatchState): number[] {
  if (s.config.gameId === 'x01') return (s.game as X01State).remaining;
  if (s.config.gameId === 'cricket') return (s.game as CricketState).score;
  return (s.game as CountUpState).total;
}

const bullOf = (s: MatchState) => (s.config.gameId === 'x01' ? (s.config.options as X01Options).bull : 'fat');

/** 状態の変化から出す演出を1つ選ぶ（WIN > GAME SHOT > アワード > BUST > BULL） */
function pickEffect(prev: MatchState, next: MatchState, d: Dart | null): { effect: Effect; sub?: string } | null {
  const names = next.config.sides.map((s) => s.name);
  if (next.matchOver && !prev.matchOver) return { effect: 'WIN', sub: names[next.matchWinner!] };
  if (next.legOver && !prev.legOver) {
    const w = next.legWinners ?? [];
    return { effect: 'GAME_SHOT', sub: w.length === 1 ? names[w[0]] : '引き分け' };
  }
  if (next.turns.length > prev.turns.length && next.lastTurn) {
    const t = next.lastTurn;
    const award = detectAward(GAMES[next.config.gameId].family, t.darts, {
      bust: t.bust,
      bull: bullOf(next),
      closedBefore: t.closedBefore,
      marks: t.marks,
    });
    if (award) return { effect: award, sub: t.player.name };
    if (t.bust) return { effect: 'BUST', sub: t.player.name };
  }
  if (d && (d.ring === 'SB' || d.ring === 'DB')) return { effect: 'BULL' };
  return null;
}

function sfxFor(e: Effect | null, d: Dart | null): SfxName {
  if (!e) return d?.ring === 'T' ? 'hitTriple' : d?.ring === 'D' ? 'hitDouble' : 'hit';
  if (e === 'BULL') return 'bull';
  if (e === 'BUST') return 'bust';
  if (e === 'WIN' || e === 'GAME_SHOT') return 'win';
  return BIG_AWARDS.includes(e as AwardId) ? 'bigAward' : 'award';
}

let voiceReady = false;
/** iOS の読み上げはユーザー操作の中で一度動かす必要がある */
function unlockVoiceOnce() {
  if (voiceReady) return;
  voiceReady = true;
  unlockVoice();
}

export function Play({ db, current, settings, onFinished, onQuit }: Props) {
  const [events, setEvents] = useState<MatchEvent[]>(current.events);
  // 1回のキー入力で複数の操作が続けて来ても取りこぼさないよう、最新のイベント列は ref で同期的に持つ
  const eventsRef = useRef(events);
  const [fx, setFx] = useState<{ effect: Effect; sub?: string } | null>(null);
  const [saveError, setSaveError] = useState(false);
  // ブル・アワードでボードを揺らす（key を変えてアニメーションをやり直す）
  const [bump, setBump] = useState(0);
  const state = useMemo(() => replay(current.config, events), [events]);
  const family = GAMES[current.config.gameId].family;
  const config = current.config;

  const commit = (next: MatchEvent[], effectFor?: Dart | null) => {
    const prev = eventsRef.current;
    if (next === prev) return;
    eventsRef.current = next;
    setEvents(next);
    db.setCurrent({ ...current, events: next }).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );
    const before = replay(config, prev);
    const after = replay(config, next);
    // 同じレグの中で次の人に替わったら「ぷるるっ」
    const changed =
      next.length > prev.length &&
      before.leg === after.leg &&
      !after.legOver &&
      (before.turnPos !== after.turnPos || before.round !== after.round);
    if (changed && settings.sfx) playSfx('change', settings.volume);
    if (effectFor === undefined) return;
    const picked = pickEffect(before, after, effectFor);
    if (settings.sfx && (picked || effectFor)) playSfx(sfxFor(picked?.effect ?? null, effectFor), settings.volume);
    if (settings.announce && picked) announce(picked.effect, settings.volume, picked.effect === 'BUST' ? 150 : 450);
    setFx(picked && settings.effects !== 'off' ? picked : null);
    if (picked && settings.effects === 'full' && picked.effect !== 'BUST') setBump((b) => b + 1);
  };

  const onDart = (d: Dart) => {
    setFx(null);
    commit(addDart(config, eventsRef.current, d), d);
  };

  const onNext = () => {
    setFx(null);
    const legOver = replay(config, eventsRef.current).legOver;
    commit(addNext(config, eventsRef.current), legOver ? undefined : null);
  };

  const onUndo = () => {
    setFx(null);
    commit(undoLast(eventsRef.current));
  };

  const finish = async () => {
    const rec = recordFromCurrent({ ...current, events: eventsRef.current }, Date.now());
    if (!rec) return;
    await db.putMatch(rec);
    await db.setCurrent(null);
    onFinished(rec);
  };

  // 自動で次の手番へ
  useEffect(() => {
    if (fx || !settings.autoAdvance || !state.turnComplete || state.legOver) return;
    const t = setTimeout(() => commit([...eventsRef.current, NEXT]), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [fx, state, events]);

  // キーボード入力
  const handlers = useRef({ onDart, onNext, onUndo, skip: () => setFx(null) });
  handlers.current = { onDart, onNext, onUndo, skip: () => setFx(null) };
  useEffect(() => {
    let ks = initialKeyState;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = (actions: KeyAction[]) => {
      for (const a of actions) {
        if (a.kind === 'dart') handlers.current.onDart(a.dart);
        else if (a.kind === 'next') handlers.current.onNext();
        else if (a.kind === 'undo') handlers.current.onUndo();
        else handlers.current.skip();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      // キー押しっぱなしで連続入力しない
      if (e.repeat) return;
      // フォーカス中のボタンの既定動作（Enter でクリック等）と二重に動かないようにする
      if ([' ', 'Backspace', 'Enter', 'Escape'].includes(e.key)) e.preventDefault();
      clearTimeout(timer);
      const r = onKey(ks, e.key, e.shiftKey, Date.now());
      ks = r.state;
      run(r.actions);
      if (ks.pendingDigit !== null) {
        timer = setTimeout(() => {
          const f = flush(ks, Date.now());
          ks = f.state;
          run(f.actions);
        }, DIGIT_WAIT_MS + 20);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, []);

  const side = currentSide(state);
  const player = currentPlayer(state);
  const scores = sideScores(state);
  const names = state.config.sides.map((s) => s.name);
  const maxRounds = GAMES[state.config.gameId].rule.maxRounds(state.config.options);
  const turnTotal = family === 'cricket' ? null : state.turnDarts.reduce((a, d) => a + points(d, bullOf(state)), 0);
  const hint =
    family === 'x01' && !state.turnComplete
      ? checkoutHint(scores[side], (state.config.options as X01Options).out, bullOf(state), 3 - state.turnDarts.length)
      : null;
  const showMember = state.config.mode === 'team';

  return (
    <div
      class="play"
      onPointerDown={unlockAudio}
      onTouchEnd={unlockVoiceOnce}
      // ボタンにフォーカスを残さない（残ると Enter キーでクリックが二重に起きる）
      onMouseDown={(e) => (e.target as Element).closest('button') && e.preventDefault()}
    >
      {saveError && <div class="save-error">保存できませんでした。この端末の空き容量やプライベートモードを確認してください。</div>}
      <header class="play-head">
        <button class="icon-btn" onClick={() => confirm('中断してホームに戻りますか？（続きから再開できます）') && onQuit()}>
          ✕
        </button>
        <div class="play-title">
          <span class="neon-c">{gameLabel(state)}</span>
          <span>
            R {Math.min(state.round, maxRounds)}/{maxRounds}
          </span>
          {state.config.legsToWin > 1 && <span>LEG {state.leg + 1}</span>}
        </div>
      </header>

      <div class="play-body">
        <section class="play-info">
          <div class="now">
            <div class="now-name">
              {showMember ? `${names[side]} / ${player.name}` : player.name}
            </div>
            <div class="now-score">{scores[side]}</div>
            {hint && (
              <div class="checkout">
                <div class="checkout-label">CHECKOUT</div>
                <div class="checkout-darts">
                  {hint.map((h, i) => (
                    <span key={i} class={i === 0 ? 'now' : ''}>
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {family === 'cricket' ? (
            <CricketBoard state={state.game as CricketState} names={names} current={side} />
          ) : (
            <X01Board match={state} scores={scores} current={side} />
          )}

          <div class="throws">
            {[0, 1, 2].map((i) => (
              <div key={i} class={`throw ${i === state.turnDarts.length && !state.turnComplete ? 'next' : ''}`}>
                {state.turnDarts[i] ? label(state.turnDarts[i]) : '-'}
              </div>
            ))}
            {turnTotal !== null && <div class="throw total">{turnTotal}</div>}
          </div>
        </section>

        <section class="play-board">
          <div key={bump} class={bump ? 'board-bump' : ''}>
          <Board onDart={onDart} highlight={state.turnDarts} target={hint ? parseLabel(hint[0]) : null} disabled={state.legOver} />
          </div>
          <div class="actions">
            <button class="btn" onClick={() => onDart({ ring: 'MISS', num: 0 })} disabled={state.legOver}>
              MISS
            </button>
            <button class="btn" onClick={onUndo} disabled={events.length === 0}>
              戻す
            </button>
            <button class="btn btn-primary" onClick={onNext} disabled={state.matchOver}>
              {state.legOver ? '次のレグ' : '次へ'}
            </button>
          </div>
        </section>
      </div>

      {state.legOver && !fx && (
        <div class="leg-panel">
          {state.matchOver ? (
            <>
              <div class="leg-title neon-m">{names[state.matchWinner!]} WIN!</div>
              <div class="leg-actions">
                <button class="btn" onClick={onUndo}>
                  戻す
                </button>
                <button class="btn btn-primary" onClick={finish}>
                  結果を見る
                </button>
              </div>
            </>
          ) : (
            <>
              <div class="leg-title neon-c">
                LEG {state.leg + 1}:{' '}
                {state.legWinners && state.legWinners.length === 1 ? `${names[state.legWinners[0]]} の勝ち` : '引き分け'}
              </div>
              <div class="leg-sub">{state.legWins.map((w, i) => `${names[i]} ${w}`).join(' / ')}</div>
              <div class="leg-actions">
                <button class="btn" onClick={onUndo}>
                  戻す
                </button>
                <button class="btn btn-primary" onClick={onNext}>
                  次のレグへ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <AwardOverlay effect={fx?.effect ?? null} sub={fx?.sub} level={settings.effects} onDone={() => setFx(null)} />
    </div>
  );
}
