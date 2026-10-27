import { countup } from './countup';
import { cricket } from './cricket';
import type { GameId, GameRule } from './types';
import { x01 } from './x01';

export type GameFamily = 'x01' | 'cricket' | 'countup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRule = GameRule<any, any>;

export const GAMES: Record<GameId, { rule: AnyRule; name: string; family: GameFamily }> = {
  x01: { rule: x01, name: '01', family: 'x01' },
  cricket: { rule: cricket, name: 'CRICKET', family: 'cricket' },
  countup: { rule: countup, name: 'COUNT-UP', family: 'countup' },
};
