import { useEffect, useState } from 'preact/hooks';
import { unlockAudio } from '../audio/sfx';
import { unlockVoice } from '../audio/voice';
import type { GameId, GameOptions } from '../games/types';
import { recordFromCurrent } from '../match/input';
import type { MatchConfig } from '../match/types';
import { openDb, type CurrentMatch, type Db, type MatchRecord, type Player, type Settings } from '../storage/db';
import { GameSelect } from './screens/GameSelect';
import { Home } from './screens/Home';
import { MatchSetup } from './screens/MatchSetup';
import { Play } from './screens/Play';
import { Players } from './screens/Players';
import { Result } from './screens/Result';
import { SettingsScreen } from './screens/Settings';
import { Stats } from './screens/Stats';

export type Screen = 'home' | 'players' | 'gameSelect' | 'setup' | 'play' | 'result' | 'stats' | 'settings';

interface Ctx {
  db: Db;
  settings: Settings;
  players: Player[];
  current: CurrentMatch | null;
}

export function App() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<{ gameId: GameId; options: GameOptions } | null>(null);
  const [result, setResult] = useState<MatchRecord | null>(null);

  const reload = async (db: Db) => {
    setCtx({ db, settings: await db.getSettings(), players: await db.listPlayers(), current: await db.getCurrent() });
  };
  useEffect(() => {
    void openDb().then(reload);
  }, []);
  if (!ctx) return null;
  const { db } = ctx;

  const start = async (config: MatchConfig) => {
    unlockAudio();
    unlockVoice();
    if (ctx.current) {
      // 決着済みで「結果を見る」を押さずに抜けた試合は、記録として残してから置き換える
      const rec = recordFromCurrent(ctx.current, Date.now());
      if (rec) await db.putMatch(rec);
      else if (!confirm('中断中のゲームがあります。破棄して新しいゲームを始めますか？')) return;
    }
    const current: CurrentMatch = { id: crypto.randomUUID(), startedAt: Date.now(), config, events: [] };
    await db.setCurrent(current);
    setCtx({ ...ctx, current });
    setScreen('play');
  };
  const goHome = async () => {
    await reload(db);
    setScreen('home');
  };

  switch (screen) {
    case 'play':
      return ctx.current ? (
        <Play
          key={ctx.current.id}
          db={db}
          current={ctx.current}
          settings={ctx.settings}
          onFinished={(m) => {
            setResult(m);
            setCtx({ ...ctx, current: null });
            setScreen('result');
          }}
          onQuit={goHome}
        />
      ) : null;
    case 'gameSelect':
      return (
        <GameSelect
          settings={ctx.settings}
          initial={game}
          onBack={() => setScreen('home')}
          onNext={(g) => {
            setGame(g);
            setScreen('setup');
          }}
        />
      );
    case 'setup':
      return game ? (
        <MatchSetup
          players={ctx.players}
          game={game}
          onBack={() => setScreen('gameSelect')}
          onStart={start}
        />
      ) : null;
    case 'result':
      return result ? (
        <Result
          record={result}
          onAgain={(rotate) => {
            const c = result.config;
            const sides = rotate ? [...c.sides.slice(1), c.sides[0]] : c.sides;
            void start({ ...c, sides });
          }}
          onHome={goHome}
        />
      ) : null;
    case 'players':
      return <Players db={db} players={ctx.players} onChange={() => reload(db)} onBack={goHome} />;
    case 'stats':
      return <Stats db={db} players={ctx.players} onBack={goHome} />;
    case 'settings':
      return <SettingsScreen db={db} settings={ctx.settings} onChange={() => reload(db)} onBack={goHome} />;
    default:
      return (
        <Home
          hasCurrent={!!ctx.current}
          onResume={() => {
            unlockAudio();
            unlockVoice();
            setScreen('play');
          }}
          onNavigate={setScreen}
        />
      );
  }
}
