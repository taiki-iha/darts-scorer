import { dart } from '../core/dart';
import type { Dart } from '../core/types';

export const DIGIT_WAIT_MS = 600;

export interface KeyState {
  mod: 'S' | 'D' | 'T';
  pendingDigit: number | null;
  pendingAt: number;
}

export const initialKeyState: KeyState = { mod: 'S', pendingDigit: null, pendingAt: 0 };

export type KeyAction =
  | { kind: 'dart'; dart: Dart }
  | { kind: 'undo' }
  | { kind: 'next' }
  | { kind: 'escape' };

type Result = { state: KeyState; actions: KeyAction[] };

function emit(s: KeyState, num: number): Result {
  return { state: { ...initialKeyState }, actions: [{ kind: 'dart', dart: dart(s.mod, num) }] };
}

/** 保留中の数字があれば確定する（時間は見ない） */
function confirmPending(s: KeyState): Result {
  if (s.pendingDigit === null) return { state: s, actions: [] };
  return emit(s, s.pendingDigit);
}

/** 保留中の数字を、待ち時間を過ぎていれば確定する */
export function flush(s: KeyState, now: number): Result {
  if (s.pendingDigit === null || now - s.pendingAt < DIGIT_WAIT_MS) return { state: s, actions: [] };
  return confirmPending(s);
}

function onDigit(s: KeyState, digit: number, now: number): Result {
  if (s.pendingDigit !== null) {
    const two = s.pendingDigit * 10 + digit;
    if (two >= 10 && two <= 20) return emit(s, two);
    // 2桁にならない → 保留分を確定し、新しい数字を改めて処理（修飾は保留分が使う）
    const first = confirmPending(s);
    const second = onDigit(first.state, digit, now);
    return { state: second.state, actions: [...first.actions, ...second.actions] };
  }
  if (digit === 0) return { state: s, actions: [] };
  if (digit === 1 || digit === 2) return { state: { ...s, pendingDigit: digit, pendingAt: now }, actions: [] };
  return emit(s, digit);
}

export function onKey(s: KeyState, key: string, shift: boolean, now: number): Result {
  // 期限切れの保留は先に確定
  const pre = flush(s, now);
  s = pre.state;
  const r = handle(s, key, shift, now);
  return { state: r.state, actions: [...pre.actions, ...r.actions] };
}

function handle(s: KeyState, key: string, shift: boolean, now: number): Result {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (/^[0-9]$/.test(k)) return onDigit(s, Number(k), now);

  switch (k) {
    case ' ': {
      const pending = confirmPending(s);
      return { state: { ...initialKeyState }, actions: [...pending.actions, { kind: 'dart', dart: dart('MISS') }] };
    }
    case 'b': {
      // 保留数字があれば先に確定（その数字が修飾を使う）
      const pending = confirmPending(s);
      const bull = shift || (s.pendingDigit === null && s.mod === 'D') ? dart('DB') : dart('SB');
      return { state: { ...initialKeyState }, actions: [...pending.actions, { kind: 'dart', dart: bull }] };
    }
    case 'd':
    case 't': {
      const pending = confirmPending(s);
      return { state: { ...pending.state, mod: k === 'd' ? 'D' : 'T' }, actions: pending.actions };
    }
    case 'Escape':
      return { state: { ...initialKeyState }, actions: [{ kind: 'escape' }] };
    case 'Enter': {
      const pending = confirmPending(s);
      return { state: { ...initialKeyState }, actions: [...pending.actions, { kind: 'next' }] };
    }
    case 'Backspace':
      if (s.pendingDigit !== null || s.mod !== 'S') return { state: { ...initialKeyState }, actions: [] };
      return { state: s, actions: [{ kind: 'undo' }] };
    default:
      return { state: s, actions: [] };
  }
}
