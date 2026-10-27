import { useState } from 'preact/hooks';
import { GAMES } from '../../games/registry';
import type { GameId, GameOptions, X01Options } from '../../games/types';
import type { MatchConfig, PlayerRef } from '../../match/types';
import type { Player } from '../../storage/db';
import { Header } from '../components/Header';
import { Seg } from '../components/Seg';

interface Props {
  players: Player[];
  game: { gameId: GameId; options: GameOptions };
  onBack: () => void;
  onStart: (c: MatchConfig) => void;
}

const MAX_SIDES = 8;
const TEAM_NAMES = ['チームA', 'チームB', 'チームC', 'チームD'];

/** ゲストは画面上で区別するためのキーを持つ */
type Entry = PlayerRef & { key: string };

const move = <T,>(arr: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function MatchSetup({ players, game, onBack, onStart }: Props) {
  const [mode, setMode] = useState<'single' | 'team'>('single');
  const [singles, setSingles] = useState<Entry[]>([]);
  const [teams, setTeams] = useState<Entry[][]>([[], []]);
  const [active, setActive] = useState(0);
  const [legsToWin, setLegsToWin] = useState(1);
  const [guestNo, setGuestNo] = useState(1);

  // まだどこにも入っていない登録プレイヤー
  const entries = mode === 'single' ? singles : teams.flat();
  const free = [...players].sort((a, b) => a.createdAt - b.createdAt).filter((p) => !entries.some((e) => e.playerId === p.id));

  const addEntry = (e: Entry) => {
    if (mode === 'single') {
      if (singles.length < MAX_SIDES) setSingles([...singles, e]);
    } else setTeams(teams.map((t, i) => (i === active ? [...t, e] : t)));
  };
  const addGuest = () => {
    addEntry({ playerId: null, name: `ゲスト${guestNo}`, key: `g${guestNo}` });
    setGuestNo(guestNo + 1);
  };
  const renameGuest = (key: string, name: string) => {
    const f = (e: Entry) => (e.key === key ? { ...e, name } : e);
    setSingles(singles.map(f));
    setTeams(teams.map((t) => t.map(f)));
  };
  const setTeamCount = (n: number) => {
    setTeams(Array.from({ length: n }, (_, i) => teams[i] ?? []));
    if (active >= n) setActive(0);
  };

  const sidesOk = mode === 'single' ? singles.length >= 1 : teams.every((t) => t.length >= 1);
  const start = () => {
    const strip = (e: Entry): PlayerRef => ({ playerId: e.playerId, name: e.name.trim() || 'ゲスト' });
    const sides =
      mode === 'single'
        ? singles.map((e) => ({ name: strip(e).name, members: [strip(e)] }))
        : teams.map((t, i) => ({ name: TEAM_NAMES[i], members: t.map(strip) }));
    onStart({ gameId: game.gameId, options: game.options, mode, sides, legsToWin });
  };

  const gameName = game.gameId === 'x01' ? String((game.options as X01Options).start) : GAMES[game.gameId].name;

  const entryRow = (e: Entry, i: number, list: Entry[], set: (l: Entry[]) => void) => (
    <li key={e.key} class="row">
      <span class="row-no">{i + 1}</span>
      {e.playerId === null ? (
        <input
          class="input row-input"
          value={e.name}
          maxLength={12}
          onInput={(ev) => renameGuest(e.key, (ev.target as HTMLInputElement).value)}
        />
      ) : (
        <span class="row-name">{e.name}</span>
      )}
      <button class="icon-btn" onClick={() => set(move(list, i, -1))} aria-label="上へ">
        ↑
      </button>
      <button class="icon-btn" onClick={() => set(move(list, i, 1))} aria-label="下へ">
        ↓
      </button>
      <button class="icon-btn" onClick={() => set(list.filter((x) => x.key !== e.key))} aria-label="外す">
        ✕
      </button>
    </li>
  );

  return (
    <main class="screen">
      <Header title={`${gameName} の対戦設定`} onBack={onBack} />
      <div class="panel opts">
        <Seg
          items={[
            { v: 'single' as const, l: '個人戦' },
            { v: 'team' as const, l: 'チーム戦' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'team' && (
          <>
            <label>チーム数</label>
            <Seg items={[2, 3, 4].map((n) => ({ v: n, l: `${n}チーム` }))} value={teams.length} onChange={setTeamCount} />
            <div class="team-tabs">
              {teams.map((t, i) => (
                <button key={i} class={`team-tab ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                  {TEAM_NAMES[i]}
                  <small>{t.length}人</small>
                </button>
              ))}
            </div>
          </>
        )}

        <label>{mode === 'single' ? '参加者（投げ順）' : `${TEAM_NAMES[active]} のメンバー（投げ順）`}</label>
        <ul class="list">
          {mode === 'single'
            ? singles.map((e, i) => entryRow(e, i, singles, setSingles))
            : teams[active].map((e, i) =>
                entryRow(e, i, teams[active], (l) => setTeams(teams.map((t, j) => (j === active ? l : t)))),
              )}
          {(mode === 'single' ? singles : teams[active]).length === 0 && <li class="empty">下から追加してください</li>}
        </ul>

        <label>追加する</label>
        <div class="chips">
          {free.map((p) => (
            <button
              key={p.id}
              class="chip"
              style={{ borderColor: p.color, color: p.color }}
              onClick={() => addEntry({ playerId: p.id, name: p.name, key: p.id })}
            >
              {p.name}
            </button>
          ))}
          <button class="chip guest" onClick={addGuest}>
            ＋ ゲスト
          </button>
        </div>

        {mode === 'team' && teams.length > 1 && (
          <>
            <label>チームの投げ順</label>
            <div class="muted">{teams.map((_, i) => TEAM_NAMES[i]).join(' → ')}（ランダムで入れ替え）</div>
          </>
        )}
        <button
          class="btn small"
          onClick={() => (mode === 'single' ? setSingles(shuffle(singles)) : setTeams(shuffle(teams)))}
        >
          投げ順をランダムにする
        </button>

        <label>レグ</label>
        <Seg items={[1, 2, 3, 5].map((n) => ({ v: n, l: n === 1 ? '1ゲーム' : `${n}レグ先取` }))} value={legsToWin} onChange={setLegsToWin} />
      </div>

      <button class="btn btn-primary wide btn-big" disabled={!sidesOk} onClick={start}>
        スタート
      </button>
    </main>
  );
}
