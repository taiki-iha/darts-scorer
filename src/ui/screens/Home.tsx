import type { Screen } from '../App';

interface Props {
  hasCurrent: boolean;
  onResume: () => void;
  onNavigate: (s: Screen) => void;
}

export function Home({ hasCurrent, onResume, onNavigate }: Props) {
  return (
    <main class="screen home">
      <h1 class="neon-title home-title">DARTS</h1>
      <div class="home-sub">SCORER</div>
      <nav class="home-menu">
        <button class="btn btn-primary btn-big" onClick={() => onNavigate('gameSelect')}>
          ゲーム開始
        </button>
        {hasCurrent && (
          <button class="btn btn-big" onClick={onResume}>
            続きから
          </button>
        )}
        <button class="btn" onClick={() => onNavigate('stats')}>
          成績
        </button>
        <button class="btn" onClick={() => onNavigate('players')}>
          プレイヤー
        </button>
        <button class="btn" onClick={() => onNavigate('settings')}>
          設定
        </button>
      </nav>
    </main>
  );
}
