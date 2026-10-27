import type { Db, Player } from '../../storage/db';
import { Header } from '../components/Header';

interface Props {
  db: Db;
  players: Player[];
  onBack: () => void;
}

// Task 13 で実装する
export function Stats({ onBack }: Props) {
  return (
    <main class="screen">
      <Header title="成績" onBack={onBack} />
    </main>
  );
}
