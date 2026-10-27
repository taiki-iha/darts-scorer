import type { BullMode, Dart, Ring } from './types';

export const dart = (ring: Ring, num?: number): Dart => {
  if (ring === 'SB' || ring === 'DB') return { ring, num: 25 };
  if (ring === 'MISS') return { ring, num: 0 };
  return { ring, num: num ?? 0 };
};

export function multiplier(d: Dart): 0 | 1 | 2 | 3 {
  switch (d.ring) {
    case 'S':
    case 'SB':
      return 1;
    case 'D':
    case 'DB':
      return 2;
    case 'T':
      return 3;
    default:
      return 0;
  }
}

export function points(d: Dart, bull: BullMode): number {
  if (d.ring === 'SB') return bull === 'fat' ? 50 : 25;
  if (d.ring === 'DB') return 50;
  return d.num * multiplier(d);
}

export function label(d: Dart): string {
  switch (d.ring) {
    case 'SB':
      return 'BULL';
    case 'DB':
      return 'D-BULL';
    case 'MISS':
      return 'MISS';
    case 'S':
      return String(d.num);
    default:
      return `${d.ring}${d.num}`;
  }
}
