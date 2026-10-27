import { useEffect, useMemo, useState } from 'preact/hooks';
import { AWARD_LABEL, type AwardId } from '../../awards/awards';
import type { Db, MatchRecord, Player } from '../../storage/db';
import { playerStats } from '../../stats/stats';
import { Header } from '../components/Header';
import { LineChart } from '../components/LineChart';
import { Seg } from '../components/Seg';

interface Props {
  db: Db;
  players: Player[];
  onBack: () => void;
}

const RANGES = [
  { v: 10, l: '直近10' },
  { v: 30, l: '直近30' },
  { v: 0, l: '全部' },
];
const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmt = (v: number, metric: string) => (metric === 'SCORE' ? String(Math.round(v)) : v.toFixed(2));

export function Stats({ db, players, onBack }: Props) {
  const sorted = [...players].sort((a, b) => a.createdAt - b.createdAt);
  const [playerId, setPlayerId] = useState(sorted[0]?.id ?? '');
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [key, setKey] = useState('');
  const [range, setRange] = useState(10);

  useEffect(() => {
    void db.listMatches().then(setMatches);
  }, []);

  const stats = useMemo(() => (matches && playerId ? playerStats(playerId, matches) : null), [matches, playerId]);
  const game = stats?.games.find((g) => g.key === key) ?? stats?.games[0];

  if (players.length === 0) {
    return (
      <main class="screen">
        <Header title="成績" onBack={onBack} />
        <div class="empty">プレイヤーを登録すると成績が記録されます</div>
      </main>
    );
  }

  // 範囲で絞った点から平均・最高を出し直す（全体の値は GameStats に入っている）
  const shown = game ? (range ? game.points.slice(-range) : game.points) : [];
  const avg = shown.length ? shown.reduce((a, p) => a + p.value, 0) / shown.length : 0;
  const max = shown.length ? Math.max(...shown.map((p) => p.value)) : 0;
  const awards = Object.entries(stats?.awards ?? {}) as [AwardId, number][];

  return (
    <main class="screen">
      <Header title="成績" onBack={onBack} />
      <div class="chips">
        {sorted.map((p) => (
          <button
            key={p.id}
            class={`chip ${p.id === playerId ? 'on' : ''}`}
            style={{ borderColor: p.color, color: p.id === playerId ? '#05010f' : p.color, background: p.id === playerId ? p.color : undefined }}
            onClick={() => {
              setPlayerId(p.id);
              setKey('');
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!matches ? null : !game ? (
        <div class="empty">まだ記録がありません</div>
      ) : (
        <>
          <div class="seg game-tabs">
            {stats!.games.map((g) => (
              <button key={g.key} class={g.key === game.key ? 'on' : ''} onClick={() => setKey(g.key)}>
                {g.label}
              </button>
            ))}
          </div>

          <div class="panel">
            <Seg items={RANGES} value={range} onChange={setRange} />
            <div class="kpis">
              <div class="kpi">
                <div class="kpi-l">平均 {game.metric}</div>
                <div class="kpi-v neon-c">{fmt(avg, game.metric)}</div>
              </div>
              <div class="kpi">
                <div class="kpi-l">MAX</div>
                <div class="kpi-v neon-m">{fmt(max, game.metric)}</div>
              </div>
              <div class="kpi">
                <div class="kpi-l">回数</div>
                <div class="kpi-v">{shown.length}</div>
              </div>
              <div class="kpi">
                <div class="kpi-l">勝率</div>
                <div class="kpi-v">{game.winRate === null ? '-' : `${Math.round(game.winRate * 100)}%`}</div>
              </div>
            </div>
            <LineChart points={shown.map((p, i) => ({ x: i, y: p.value }))} yLabel={game.metric} avg={avg} />
            <div class="muted small-text">
              全期間: 平均 {fmt(game.avg, game.metric)} / MAX {fmt(game.max, game.metric)} / {game.count}回
            </div>
          </div>

          {awards.length > 0 && (
            <div class="panel">
              <div class="panel-title">アワード累計（全ゲーム）</div>
              <div class="award-list">
                {awards.map(([a, n]) => (
                  <div key={a} class="award-item">
                    <span>{AWARD_LABEL[a]}</span>
                    <b>{n}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div class="panel">
            <div class="panel-title">履歴</div>
            <table class="table">
              <tbody>
                {[...game.points].reverse().slice(0, 50).map((p) => (
                  <tr key={p.matchId}>
                    <td>{fmtDate(p.date)}</td>
                    <td class="num">{fmt(p.value, game.metric)}</td>
                    <td class="num">{p.won ? <span class="neon-m">WIN</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
