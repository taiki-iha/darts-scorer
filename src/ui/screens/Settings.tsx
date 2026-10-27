import { useRef, useState } from 'preact/hooks';
import type { Db, Settings } from '../../storage/db';
import { Header } from '../components/Header';
import { Seg } from '../components/Seg';

interface Props {
  db: Db;
  settings: Settings;
  onChange: () => void;
  onBack: () => void;
}

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

export function SettingsScreen({ db, settings, onChange, onBack }: Props) {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const update = async (next: Settings) => {
    setS(next);
    await db.setSettings(next);
    onChange();
  };

  const exportData = async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `darts-scorer-${ymd(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`書き出しました（プレイヤー ${data.players.length}人・試合 ${data.matches.length}件）`);
  };

  const importData = async (file: File) => {
    if (!confirm('今のデータをすべて置き換えます。よろしいですか？')) return;
    try {
      await db.importAll(JSON.parse(await file.text()));
      const next = await db.getSettings();
      setS(next);
      onChange();
      setMsg('読み込みました');
    } catch {
      setMsg('ファイルの形式が正しくありません');
    }
  };

  const clearAll = async () => {
    if (!confirm('すべてのプレイヤー・試合記録・設定を削除します。よろしいですか？')) return;
    if (!confirm('本当に削除しますか？元に戻せません。')) return;
    await db.clearAll();
    setS(await db.getSettings());
    onChange();
    setMsg('削除しました');
  };

  return (
    <main class="screen">
      <Header title="設定" onBack={onBack} />
      <div class="panel opts">
        <label>効果音</label>
        <Seg
          items={[
            { v: 1, l: 'ON' },
            { v: 0, l: 'OFF' },
          ]}
          value={s.sfx ? 1 : 0}
          onChange={(v) => update({ ...s, sfx: v === 1 })}
        />
        <label>音量 {Math.round(s.volume * 100)}%</label>
        <input
          class="range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => update({ ...s, volume: Number((e.target as HTMLInputElement).value) })}
        />
        <label>アナウンス音声（英語）</label>
        <Seg
          items={[
            { v: 1, l: 'ON' },
            { v: 0, l: 'OFF' },
          ]}
          value={s.announce ? 1 : 0}
          onChange={(v) => update({ ...s, announce: v === 1 })}
        />
        <label>演出</label>
        <Seg
          items={[
            { v: 'full' as const, l: 'フル' },
            { v: 'lite' as const, l: '簡易' },
            { v: 'off' as const, l: 'なし' },
          ]}
          value={s.effects}
          onChange={(v) => update({ ...s, effects: v })}
        />
        <label>3投後に自動で次の人へ</label>
        <Seg
          items={[
            { v: 1, l: 'する' },
            { v: 0, l: 'しない' },
          ]}
          value={s.autoAdvance ? 1 : 0}
          onChange={(v) => update({ ...s, autoAdvance: v === 1 })}
        />
        <label>ブルの初期設定（01）</label>
        <Seg
          items={[
            { v: 'fat' as const, l: 'ファット' },
            { v: 'separate' as const, l: 'セパレート' },
          ]}
          value={s.defaultBull}
          onChange={(v) => update({ ...s, defaultBull: v })}
        />
      </div>

      <div class="panel opts">
        <label>データ</label>
        <button class="btn" onClick={exportData}>
          書き出し（バックアップ）
        </button>
        <button class="btn" onClick={() => fileRef.current?.click()}>
          読み込み（復元）
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void importData(f);
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <button class="btn danger" onClick={clearAll}>
          全データ削除
        </button>
        {msg && <div class="msg">{msg}</div>}
      </div>

      <div class="muted small-text">
        記録はこの端末のブラウザ内に保存されます。iPhone では「ホーム画面に追加」して使うと消えにくくなります。
      </div>
    </main>
  );
}
