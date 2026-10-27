import { useState } from 'preact/hooks';
import { GAMES } from '../../games/registry';
import type { CricketOptions, GameId, GameOptions, InOut, X01Options } from '../../games/types';
import { defaultRoundsFor, x01 } from '../../games/x01';
import type { Settings } from '../../storage/db';
import { Header } from '../components/Header';
import { Seg } from '../components/Seg';

interface Props {
  settings: Settings;
  initial: { gameId: GameId; options: GameOptions } | null;
  onBack: () => void;
  onNext: (g: { gameId: GameId; options: GameOptions }) => void;
}

const STARTS: X01Options['start'][] = [301, 501, 701, 901, 1101, 1501];
const INOUT: { v: InOut; l: string }[] = [
  { v: 'open', l: 'オープン' },
  { v: 'double', l: 'ダブル' },
  { v: 'master', l: 'マスター' },
];

export function GameSelect({ settings, initial, onBack, onNext }: Props) {
  const [gameId, setGameId] = useState<GameId>(initial?.gameId ?? 'x01');
  const [xo, setXo] = useState<X01Options>(
    initial?.gameId === 'x01' ? (initial.options as X01Options) : { ...x01.defaults(), bull: settings.defaultBull },
  );
  const [co, setCo] = useState<CricketOptions>(
    initial?.gameId === 'cricket' ? (initial.options as CricketOptions) : GAMES.cricket.rule.defaults(),
  );

  const options = (): GameOptions => (gameId === 'x01' ? xo : gameId === 'cricket' ? co : GAMES.countup.rule.defaults());

  return (
    <main class="screen">
      <Header title="ゲーム選択" onBack={onBack} />
      <div class="game-cards">
        {(Object.keys(GAMES) as GameId[]).map((id) => (
          <button key={id} class={`game-card ${id === gameId ? 'on' : ''}`} onClick={() => setGameId(id)}>
            {GAMES[id].name}
          </button>
        ))}
      </div>

      {gameId === 'x01' && (
        <div class="panel opts">
          <label>持ち点</label>
          <Seg
            items={STARTS.map((s) => ({ v: s, l: String(s) }))}
            value={xo.start}
            onChange={(start) => setXo({ ...xo, start, maxRounds: defaultRoundsFor(start) })}
          />
          <label>IN</label>
          <Seg items={INOUT} value={xo.in} onChange={(v) => setXo({ ...xo, in: v })} />
          <label>OUT</label>
          <Seg items={INOUT} value={xo.out} onChange={(v) => setXo({ ...xo, out: v })} />
          <label>ブル</label>
          <Seg
            items={[
              { v: 'fat' as const, l: 'ファット（50）' },
              { v: 'separate' as const, l: 'セパレート（25/50）' },
            ]}
            value={xo.bull}
            onChange={(v) => setXo({ ...xo, bull: v })}
          />
          <label>ラウンド上限</label>
          <Seg
            items={[10, 15, 20, 25, 30].map((r) => ({ v: r, l: `${r}R` }))}
            value={xo.maxRounds}
            onChange={(v) => setXo({ ...xo, maxRounds: v })}
          />
        </div>
      )}
      {gameId === 'cricket' && (
        <div class="panel opts">
          <label>ラウンド上限</label>
          <Seg items={[15, 20, 25].map((r) => ({ v: r, l: `${r}R` }))} value={co.maxRounds} onChange={(v) => setCo({ maxRounds: v })} />
        </div>
      )}
      {gameId === 'countup' && <div class="panel opts muted">8ラウンドの合計点を競います（ブルは50点）。</div>}

      <button class="btn btn-primary wide btn-big" onClick={() => onNext({ gameId, options: options() })}>
        次へ（プレイヤー選択）
      </button>
    </main>
  );
}
