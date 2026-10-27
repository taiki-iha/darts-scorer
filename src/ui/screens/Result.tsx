import { useMemo } from 'preact/hooks';
import { detectAward } from '../../awards/awards';
import { GAMES } from '../../games/registry';
import type { X01Options } from '../../games/types';
import { replay } from '../../match/engine';
import type { MatchRecord } from '../../storage/db';
import { gameLabel } from './Play';

interface Props {
  record: MatchRecord;
  onAgain: (rotateOrder: boolean) => void;
  onHome: () => void;
}

interface Line {
  name: string;
  darts: number;
  value: string;
  awards: number;
}

export function Result({ record, onAgain, onHome }: Props) {
  const { state, lines, metric } = useMemo(() => {
    const state = replay(record.config, record.events);
    const family = GAMES[record.config.gameId].family;
    const bull = record.config.gameId === 'x01' ? (record.config.options as X01Options).bull : 'fat';
    // プレイヤー（ゲストは名前）ごとに集計
    const byName = new Map<string, Line & { sum: number }>();
    for (const t of state.throws) {
      const key = t.player.playerId ?? `guest:${t.player.name}`;
      const l = byName.get(key) ?? { name: t.player.name, darts: 0, value: '', awards: 0, sum: 0 };
      l.darts += 1;
      l.sum += family === 'cricket' ? t.marks ?? 0 : t.points ?? 0;
      byName.set(key, l);
    }
    for (const t of state.turns) {
      const key = t.player.playerId ?? `guest:${t.player.name}`;
      const a = detectAward(family, t.darts, { bust: t.bust, bull, closedBefore: t.closedBefore, marks: t.marks });
      if (a && byName.has(key)) byName.get(key)!.awards += 1;
    }
    const lines = [...byName.values()].map((l) => ({
      ...l,
      value: family === 'cricket' ? ((l.sum * 3) / l.darts).toFixed(2) : family === 'x01' ? (l.sum / l.darts).toFixed(2) : String(l.sum),
    }));
    const metric = family === 'cricket' ? 'MPR' : family === 'x01' ? 'PPD' : 'SCORE';
    return { state, lines, metric };
  }, [record]);

  const names = record.config.sides.map((s) => s.name);
  const winner = record.winner !== null ? names[record.winner] : null;

  return (
    <main class="screen result">
      <div class="result-game">{gameLabel(state)}</div>
      <div class="result-winner neon-m">{winner ? `${winner} WIN!` : 'FINISH'}</div>
      {record.config.legsToWin > 1 && <div class="muted center-text">{names.map((n, i) => `${n} ${record.legWins[i]}`).join(' / ')}</div>}

      <table class="table">
        <thead>
          <tr>
            <th>プレイヤー</th>
            <th>{metric}</th>
            <th>投数</th>
            <th>アワード</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.name}>
              <td>{l.name}</td>
              <td class="num">{l.value}</td>
              <td class="num">{l.darts}</td>
              <td class="num">{l.awards}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div class="result-actions">
        <button class="btn btn-primary btn-big" onClick={() => onAgain(false)}>
          もう一度
        </button>
        {names.length > 1 && (
          <button class="btn" onClick={() => onAgain(true)}>
            投げ順を入れ替えて
          </button>
        )}
        <button class="btn" onClick={onHome}>
          ホーム
        </button>
      </div>
    </main>
  );
}
