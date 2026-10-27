// 効果音はすべて Web Audio API で合成する（外部音源なし）。
// 本物のマシンっぽい重さを出すため、低音の衝撃・ノイズ・残響を重ねる。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    // 音割れしないようコンプレッサーを通す
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.2, 2.5);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
  }
  return ctx;
}

/** 残響用のインパルス応答（減衰するノイズ） */
function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** ユーザー操作の中で呼ぶ（iOS Safari は最初の操作まで音が出ない） */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  // iOS は通話・アプリ切替の後 'interrupted' になるので running 以外は再開を試みる
  if (c.state !== 'running') void c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

interface Out {
  c: AudioContext;
  dry: AudioNode;
  wet: AudioNode;
  t: number;
}

/** 音量つきの出力（dry は直接、wet は残響へ） */
function output(volume: number, wetAmount: number): Out | null {
  const c = ac();
  if (!c || !master || !reverb || volume <= 0) return null;
  if (c.state !== 'running') void c.resume();
  const dry = c.createGain();
  dry.gain.value = volume;
  dry.connect(master);
  const wet = c.createGain();
  wet.gain.value = volume * wetAmount;
  wet.connect(reverb);
  const bus = c.createGain();
  bus.connect(dry);
  bus.connect(wet);
  return { c, dry: bus, wet, t: c.currentTime + 0.005 };
}

function env(g: GainNode, at: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function osc(o: Out, type: OscillatorType, f0: number, f1: number, at: number, attack: number, decay: number, peak: number, detune = 0) {
  const { c } = o;
  const s = c.createOscillator();
  const g = c.createGain();
  s.type = type;
  s.detune.value = detune;
  s.frequency.setValueAtTime(f0, at);
  s.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), at + attack + decay);
  env(g, at, peak, attack, decay);
  s.connect(g).connect(o.dry);
  s.start(at);
  s.stop(at + attack + decay + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(o: Out, filter: BiquadFilterType, f0: number, f1: number, at: number, attack: number, decay: number, peak: number, q = 0.7) {
  const { c } = o;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), at + attack + decay);
  const g = c.createGain();
  env(g, at, peak, attack, decay);
  src.connect(f).connect(g).connect(o.dry);
  src.start(at);
  src.stop(at + attack + decay + 0.05);
}

/** 低音の衝撃（ドンッ） */
function boom(o: Out, at: number, size: number) {
  osc(o, 'sine', 120 * size, 32, at, 0.004, 0.55 * size, 0.9);
  osc(o, 'triangle', 220, 50, at, 0.002, 0.18, 0.4);
  noise(o, 'lowpass', 4000, 150, at, 0.002, 0.45 * size, 0.7);
}

/** シンバルのような金属的な余韻 */
function crash(o: Out, at: number, length: number, peak = 0.35) {
  noise(o, 'highpass', 7000, 4000, at, 0.003, length, peak);
  noise(o, 'bandpass', 9000, 6000, at, 0.003, length * 0.6, peak * 0.6, 2);
}

/** ブラスっぽい和音（ノコギリ波を重ねてフィルターを開く） */
function brass(o: Out, freqs: number[], at: number, length: number, peak: number) {
  const { c } = o;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(300, at);
  f.frequency.exponentialRampToValueAtTime(5000, at + 0.15);
  f.frequency.exponentialRampToValueAtTime(1200, at + length);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.04);
  g.gain.setValueAtTime(peak, at + length * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  f.connect(g).connect(o.dry);
  for (const fr of freqs) {
    for (const det of [-8, 7]) {
      const s = c.createOscillator();
      s.type = 'sawtooth';
      s.frequency.value = fr;
      s.detune.value = det;
      s.connect(f);
      s.start(at);
      s.stop(at + length + 0.05);
    }
  }
}

/** キラキラ（高い音の上昇アルペジオ） */
function sparkle(o: Out, at: number, count: number, base = 1047) {
  for (let i = 0; i < count; i++) {
    const f = base * Math.pow(2, (i * 4) / 12);
    osc(o, 'triangle', f, f, at + i * 0.045, 0.003, 0.25, 0.12);
  }
}

/** 「てゅー」1回分: 高い音から急に下がるレーザー音（矩形波＋サイン波） */
function tyu(o: Out, at: number, len: number, top: number) {
  osc(o, 'square', top, top * 0.35, at, 0.004, len, 0.1);
  osc(o, 'sine', top * 1.5, top * 0.5, at, 0.004, len, 0.14);
}

export type SfxName = 'hit' | 'hitDouble' | 'hitTriple' | 'bull' | 'bust' | 'award' | 'bigAward' | 'win' | 'change';

export function playSfx(name: SfxName, volume: number): void {
  switch (name) {
    case 'hit': {
      // 刺さった音: 短く重い「トッ」
      const o = output(volume, 0.15);
      if (!o) return;
      osc(o, 'sine', 180, 60, o.t, 0.002, 0.09, 0.8);
      noise(o, 'bandpass', 2500, 900, o.t, 0.001, 0.05, 0.6, 1.2);
      break;
    }
    case 'hitDouble':
    case 'hitTriple': {
      // 「てゅーてゅーてゅー」: 音程が下がる電子音をすばやく繰り返す（ダブルは2回）
      const o = output(volume, 0.35);
      if (!o) return;
      osc(o, 'sine', 180, 60, o.t, 0.002, 0.09, 0.8);
      noise(o, 'bandpass', 2500, 900, o.t, 0.001, 0.05, 0.6, 1.2);
      const n = name === 'hitTriple' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const at = o.t + 0.04 + i * 0.1;
        const last = i === n - 1;
        const len = last ? 0.22 : 0.08;
        tyu(o, at, len, name === 'hitTriple' ? 2400 : 2000);
      }
      break;
    }
    case 'change': {
      // 「ぷるるっ」: 震える短い電子音
      const o = output(volume, 0.2);
      if (!o) return;
      const { c } = o;
      const s = c.createOscillator();
      const lfo = c.createOscillator();
      const depth = c.createGain();
      const g = c.createGain();
      s.type = 'square';
      s.frequency.setValueAtTime(880, o.t);
      s.frequency.exponentialRampToValueAtTime(1100, o.t + 0.28);
      lfo.frequency.value = 28;
      depth.gain.value = 140;
      lfo.connect(depth).connect(s.frequency);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, o.t);
      g.gain.exponentialRampToValueAtTime(0.16, o.t + 0.015);
      g.gain.setValueAtTime(0.16, o.t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, o.t + 0.32);
      s.connect(f).connect(g).connect(o.dry);
      s.start(o.t);
      lfo.start(o.t);
      s.stop(o.t + 0.35);
      lfo.stop(o.t + 0.35);
      break;
    }
    case 'bull': {
      // どーん: 衝撃＋シュワッ＋金属音＋残響
      const o = output(volume, 0.6);
      if (!o) return;
      boom(o, o.t, 1.2);
      noise(o, 'bandpass', 600, 5000, o.t + 0.02, 0.08, 0.5, 0.35, 1.5);
      osc(o, 'square', 660, 640, o.t, 0.003, 0.5, 0.08);
      osc(o, 'square', 990, 960, o.t, 0.003, 0.45, 0.06, 5);
      crash(o, o.t + 0.01, 0.9, 0.2);
      break;
    }
    case 'bust': {
      // 失敗: 重い音のあと下がる「ワワワーン」
      const o = output(volume, 0.4);
      if (!o) return;
      osc(o, 'sine', 90, 40, o.t, 0.003, 0.4, 0.8);
      [392, 370, 349, 262].forEach((f, i) => {
        const at = o.t + 0.1 + i * 0.22;
        osc(o, 'sawtooth', f, i === 3 ? f * 0.7 : f, at, 0.02, i === 3 ? 0.7 : 0.2, 0.12);
      });
      break;
    }
    case 'award': {
      // 中くらいのアワード: 衝撃＋上昇ファンファーレ
      const o = output(volume, 0.5);
      if (!o) return;
      boom(o, o.t, 0.9);
      noise(o, 'bandpass', 300, 6000, o.t, 0.25, 0.1, 0.2, 1.2);
      brass(o, [262, 330, 392], o.t + 0.08, 0.35, 0.12);
      brass(o, [330, 415, 494, 659], o.t + 0.4, 0.8, 0.14);
      crash(o, o.t + 0.4, 1.0, 0.22);
      sparkle(o, o.t + 0.45, 5);
      break;
    }
    case 'bigAward': {
      // ばばーーん: ため→爆発→ブラス和音→シンバル→キラキラ
      const o = output(volume, 0.7);
      if (!o) return;
      noise(o, 'bandpass', 200, 8000, o.t, 0.35, 0.05, 0.25, 1.5);
      osc(o, 'sawtooth', 80, 800, o.t, 0.3, 0.05, 0.1);
      const hit = o.t + 0.38;
      boom(o, hit, 1.6);
      boom(o, hit + 0.12, 1.2);
      brass(o, [131, 262, 330, 392, 523], hit, 1.6, 0.16);
      crash(o, hit, 2.2, 0.4);
      sparkle(o, hit + 0.15, 8, 1319);
      sparkle(o, hit + 0.7, 6, 1568);
      break;
    }
    case 'win': {
      // 勝利: ファンファーレのメロディ＋最後に爆発
      const o = output(volume, 0.6);
      if (!o) return;
      const notes: [number[], number, number][] = [
        [[392, 494], 0, 0.14],
        [[392, 494], 0.16, 0.14],
        [[392, 494], 0.32, 0.14],
        [[523, 659, 784], 0.5, 0.9],
        [[466, 587], 1.0, 0.25],
        [[523, 659, 784, 1047], 1.3, 1.4],
      ];
      for (const [fs, at, len] of notes) brass(o, fs, o.t + at, len, 0.14);
      boom(o, o.t + 0.5, 1.2);
      boom(o, o.t + 1.3, 1.6);
      crash(o, o.t + 1.3, 2.4, 0.4);
      sparkle(o, o.t + 1.4, 8, 1319);
      break;
    }
  }
}
