import type { AwardId, MinorEffect } from '../awards/awards';

// ブラウザの読み上げ機能（Web Speech API）で英語のアナウンスを出す

export const ANNOUNCE: Partial<Record<AwardId | MinorEffect, string>> = {
  TON80: 'Ton eighty!',
  HIGH_TON: 'High ton!',
  LOW_TON: 'Low ton!',
  HAT_TRICK: 'Hat trick!',
  THREE_IN_THE_BLACK: 'Three in the black!',
  THREE_IN_A_BED: 'Three in a bed!',
  WHITE_HORSE: 'White horse!',
  NINE_MARKS: 'Nine marks!',
  EIGHT_MARKS: 'Eight marks!',
  SEVEN_MARKS: 'Seven marks!',
  SIX_MARKS: 'Six marks!',
  FIVE_MARKS: 'Five marks!',
  BUST: 'Bust!',
  GAME_SHOT: 'Game shot!',
  WIN: 'Winner!',
};

let voice: SpeechSynthesisVoice | null | undefined;

/** 英語の声を選ぶ（男性っぽい声・ネイティブ英語を優先） */
function pickVoice(): SpeechSynthesisVoice | null {
  const all = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (all.length === 0) return null;
  const prefer = [/daniel/i, /alex/i, /fred/i, /google uk english male/i, /male/i, /en-gb/i, /en-us/i];
  for (const re of prefer) {
    const v = all.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  return all[0];
}

/** 演出に合わせて読み上げる。delayMs は衝撃音のあとに声を重ねるための待ち */
export function announce(effect: AwardId | MinorEffect, volume: number, delayMs = 250): void {
  const text = ANNOUNCE[effect];
  if (!text || typeof speechSynthesis === 'undefined' || volume <= 0) return;
  setTimeout(() => {
    if (voice === undefined || voice === null) voice = pickVoice();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? 'en-US';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = effect === 'BUST' ? 0.7 : 0.85;
    u.volume = Math.min(1, volume * 1.2);
    speechSynthesis.speak(u);
  }, delayMs);
}

/** iOS は最初のユーザー操作の中で一度話させないと声が出ないことがあるので、無音で準備する */
export function unlockVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
  voice = pickVoice();
}
