interface Props<T> {
  items: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** 選択肢ボタンの並び（セグメント切替） */
export function Seg<T extends string | number>({ items, value, onChange }: Props<T>) {
  return (
    <div class="seg">
      {items.map((it) => (
        <button key={String(it.v)} class={it.v === value ? 'on' : ''} onClick={() => onChange(it.v)}>
          {it.l}
        </button>
      ))}
    </div>
  );
}
