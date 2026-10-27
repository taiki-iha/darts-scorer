import { useEffect } from 'preact/hooks';
import { AWARD_LABEL, BIG_AWARDS, type AwardId, type MinorEffect } from '../../awards/awards';
import type { Settings } from '../../storage/db';

export type Effect = AwardId | MinorEffect;

const COLORS = ['#00e5ff', '#ff2bd6', '#ffe14d', '#ffffff', '#39ff14'];
/** 紙吹雪（位置・色・速さはランダムだが、毎回同じ並びで十分なので一度だけ作る） */
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  background: COLORS[i % COLORS.length],
  animationDelay: `${((i * 13) % 10) * 0.05}s`,
  animationDuration: `${1.4 + ((i * 7) % 10) * 0.08}s`,
  '--rx': `${(i % 2 ? 1 : -1) * (180 + ((i * 29) % 360))}deg`,
  '--dx': `${((i * 17) % 60) - 30}px`,
}));

const MINOR_LABEL: Record<MinorEffect, string> = {
  BULL: 'BULL!',
  BUST: 'BUST',
  GAME_SHOT: 'GAME SHOT!',
  WIN: 'WIN!',
};

export const effectLabel = (e: Effect) => (e in MINOR_LABEL ? MINOR_LABEL[e as MinorEffect] : AWARD_LABEL[e as AwardId]);

/** 演出の長さ（ミリ秒） */
export function effectDuration(e: Effect, level: Settings['effects']): number {
  if (level === 'off') return 0;
  const full =
    e === 'WIN' ? 2400 : e === 'GAME_SHOT' ? 1600 : e === 'BULL' ? 600 : e === 'BUST' ? 1200 : BIG_AWARDS.includes(e as AwardId) ? 2000 : 1200;
  return level === 'lite' ? Math.min(full, 800) : full;
}

const kind = (e: Effect) =>
  e === 'BULL' ? 'small' : e === 'BUST' ? 'bust' : e === 'WIN' || e === 'GAME_SHOT' || BIG_AWARDS.includes(e as AwardId) ? 'big' : 'mid';

interface Props {
  effect: Effect | null;
  /** 演出の上に小さく出す補足（プレイヤー名・勝者名など） */
  sub?: string;
  onDone: () => void;
  level: Settings['effects'];
}

export function AwardOverlay({ effect, sub, onDone, level }: Props) {
  useEffect(() => {
    if (!effect) return;
    const t = setTimeout(onDone, effectDuration(effect, level));
    return () => clearTimeout(t);
  }, [effect, level]);

  if (!effect || level === 'off') return null;
  const k = kind(effect);
  return (
    <div class={`fx fx-${k} ${level === 'lite' ? 'fx-lite' : ''}`} onClick={onDone}>
      {level === 'full' && k !== 'small' && (
        <div class="fx-rays">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
        </div>
      )}
      {level === 'full' && k !== 'small' && <div class="fx-flash" />}
      {level === 'full' && k === 'big' && (
        <div class="fx-confetti">
          {CONFETTI.map((c, i) => (
            <i key={i} style={c} />
          ))}
        </div>
      )}
      {level === 'full' && k === 'big' && (
        <div class="fx-sparks">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ '--a': `${i * 15}deg`, '--d': `${(i % 4) * 0.08}s` } as Record<string, string>} />
          ))}
        </div>
      )}
      <div class="fx-text">{effectLabel(effect)}</div>
      {sub && <div class="fx-sub">{sub}</div>}
    </div>
  );
}
