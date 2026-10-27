import { useEffect, useState } from 'preact/hooks';
import { x01 } from '../games/x01';
import { openDb, type CurrentMatch, type Db, type Settings } from '../storage/db';
import { Play } from './screens/Play';

// 仮: Task 12 で画面切替に置き換える
export function App() {
  const [ctx, setCtx] = useState<{ db: Db; current: CurrentMatch; settings: Settings } | null>(null);
  useEffect(() => {
    void (async () => {
      const db = await openDb();
      const current =
        (await db.getCurrent()) ??
        ({
          id: crypto.randomUUID(),
          startedAt: Date.now(),
          config: {
            gameId: 'x01',
            options: { ...x01.defaults(), start: 501 },
            mode: 'single',
            sides: [
              { name: 'たろう', members: [{ playerId: 'p1', name: 'たろう' }] },
              { name: 'はなこ', members: [{ playerId: 'p2', name: 'はなこ' }] },
            ],
            legsToWin: 1,
          },
          events: [],
        } satisfies CurrentMatch);
      setCtx({ db, current, settings: await db.getSettings() });
    })();
  }, []);
  if (!ctx) return null;
  return <Play {...ctx} onFinished={() => location.reload()} onQuit={() => location.reload()} />;
}
