// 効果音はすべて Web Audio API で合成する（外部音源なし）

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

/** ユーザー操作の中で呼ぶ（iOS Safari は最初の操作まで音が出ない） */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  // 無音を1つ鳴らしてアンロックを確実にする
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

function tone(c: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(c: AudioContext, out: AudioNode, at: number, dur: number, vol: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1500;
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(at);
}

export type SfxName = 'hit' | 'bull' | 'bust' | 'award' | 'bigAward' | 'win';

export function playSfx(name: SfxName, volume: number): void {
  const c = ac();
  if (!c || volume <= 0) return;
  if (c.state === 'suspended') void c.resume();
  const out = c.createGain();
  out.gain.value = volume;
  out.connect(c.destination);
  const t = c.currentTime;

  switch (name) {
    case 'hit':
      noise(c, out, t, 0.05, 0.4);
      tone(c, out, 'square', 900, 500, t, 0.06, 0.15);
      break;
    case 'bull':
      tone(c, out, 'sawtooth', 300, 1200, t, 0.25, 0.25);
      tone(c, out, 'sine', 1200, 1800, t + 0.1, 0.3, 0.2);
      break;
    case 'bust':
      tone(c, out, 'sawtooth', 400, 80, t, 0.6, 0.3);
      tone(c, out, 'square', 200, 60, t + 0.05, 0.6, 0.15);
      break;
    case 'award':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, out, 'square', f, f, t + i * 0.08, 0.2, 0.15));
      break;
    case 'bigAward':
      tone(c, out, 'sawtooth', 100, 2000, t, 0.7, 0.2);
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, out, 'square', f, f * 1.01, t + 0.3 + i * 0.07, 0.35, 0.14));
      noise(c, out, t + 0.3, 0.8, 0.15);
      break;
    case 'win':
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(c, out, 'triangle', f, f, t + i * 0.12, 0.3, 0.25));
      noise(c, out, t + 0.8, 1.2, 0.1);
      break;
  }
}
