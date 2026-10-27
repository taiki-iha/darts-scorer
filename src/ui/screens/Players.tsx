import { useState } from 'preact/hooks';
import type { Db, Player } from '../../storage/db';
import { Header } from '../components/Header';

export const PLAYER_COLORS = ['#00e5ff', '#ff2bd6', '#ffe14d', '#39ff14', '#ff8c1a', '#a66bff', '#ff4d6d', '#ffffff'];

interface Props {
  db: Db;
  players: Player[];
  onChange: () => void;
  onBack: () => void;
}

export function Players({ db, players, onChange, onBack }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PLAYER_COLORS[0]);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    // 保存を待つ間に次の名前を打ち始めても混ざらないよう、先に入力欄を空にする
    setName('');
    await db.putPlayer({ id: crypto.randomUUID(), name: n, color, createdAt: Date.now() });
    onChange();
  };
  const rename = async (p: Player) => {
    const n = prompt('新しい名前', p.name)?.trim();
    if (!n) return;
    await db.putPlayer({ ...p, name: n });
    onChange();
  };
  const recolor = async (p: Player) => {
    const i = PLAYER_COLORS.indexOf(p.color);
    await db.putPlayer({ ...p, color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length] });
    onChange();
  };
  const remove = async (p: Player) => {
    if (!confirm(`${p.name} を削除しますか？（過去の試合記録は残ります）`)) return;
    await db.deletePlayer(p.id);
    onChange();
  };

  return (
    <main class="screen">
      <Header title="プレイヤー" onBack={onBack} />
      <form
        class="panel"
        onSubmit={(e) => {
          // フォーム送信にすることで、日本語変換確定の Enter では追加されない
          e.preventDefault();
          void add();
        }}
      >
        <input
          class="input"
          placeholder="名前を入力"
          value={name}
          maxLength={12}
          enterKeyHint="done"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
        <div class="colors">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              class={`color ${c === color ? 'on' : ''}`}
              type="button"
              style={{ background: c }}
              aria-label={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button type="submit" class="btn btn-primary wide" disabled={!name.trim()}>
          追加
        </button>
      </form>

      <ul class="list">
        {players.length === 0 && <li class="empty">まだプレイヤーがいません</li>}
        {[...players]
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((p) => (
            <li key={p.id} class="row">
              <button class="dot" style={{ background: p.color }} aria-label="色を変える" onClick={() => recolor(p)} />
              <span class="row-name">{p.name}</span>
              <button class="btn small" onClick={() => rename(p)}>
                名前変更
              </button>
              <button class="btn small danger" onClick={() => remove(p)}>
                削除
              </button>
            </li>
          ))}
      </ul>
    </main>
  );
}
