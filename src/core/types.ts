export type Ring = 'S' | 'D' | 'T' | 'SB' | 'DB' | 'MISS';

/** num: 1-20、SB/DB は 25、MISS は 0 */
export interface Dart {
  ring: Ring;
  num: number;
}

export type BullMode = 'fat' | 'separate';
