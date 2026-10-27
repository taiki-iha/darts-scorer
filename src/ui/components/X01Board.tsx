import type { MatchState } from '../../match/types';

interface Props {
  match: MatchState;
  /** サイドごとの表示スコア */
  scores: number[];
  current: number;
}

/** 01・カウントアップ用のサイド一覧（手番をグロー） */
export function X01Board({ match, scores, current }: Props) {
  const { sides, legsToWin } = match.config;
  return (
    <div class="sides">
      {sides.map((s, i) => (
        <div key={i} class={`side ${i === current ? 'cur' : ''}`}>
          <div class="side-name">{s.name}</div>
          <div class="side-score">{scores[i]}</div>
          {legsToWin > 1 && <div class="side-legs">{'●'.repeat(match.legWins[i]) || '　'}</div>}
        </div>
      ))}
    </div>
  );
}
