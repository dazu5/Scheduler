// Issue #18 chunk 2 — CategoryBadge primitive.
//
// Displays a Category with its palette color. Used in the Now Panel,
// Dashboard tiles, and Session list rows. Color comes from the
// `--color-cat-*` @theme tokens defined in styles.css.

const LABELS = {
  animation: 'Animation',
  workflow: 'Workflow',
  cornerman: 'Cornerman',
  break: 'Break',
} as const;

export type CategoryKey = keyof typeof LABELS;

export interface CategoryBadgeProps {
  category: CategoryKey;
  /** Show only the color dot, no label text (compact mode for tight rows). */
  compact?: boolean;
}

const DOT: Record<CategoryKey, string> = {
  animation: 'bg-cat-animation',
  workflow: 'bg-cat-workflow',
  cornerman: 'bg-cat-cornerman',
  break: 'bg-cat-break',
};

export function CategoryBadge({ category, compact = false }: CategoryBadgeProps) {
  const label = LABELS[category];
  return (
    <span
      data-category={category}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-fg"
      aria-label={`Category: ${label}`}
    >
      <span className={`inline-block size-2 rounded-full ${DOT[category]}`} aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </span>
  );
}
