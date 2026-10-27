interface Props {
  title: string;
  onBack: () => void;
}

export function Header({ title, onBack }: Props) {
  return (
    <header class="head">
      <button class="icon-btn" onClick={onBack} aria-label="戻る">
        ←
      </button>
      <h2 class="head-title">{title}</h2>
    </header>
  );
}
