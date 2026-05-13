// Issue #18 chunk 2 + chunk 7 — CategoryBadge primitive.
//
// "Pill" treatment matching weekly_scheduler.html — a dark
// category-tinted background with the bright category accent as
// foreground text, uppercase + letter-spaced for chip-like density.
// Used in the Now Panel, the Dashboard tiles (slice #11+), and any
// row that needs a Category label outside a full Session block.

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

// Static lookups so Tailwind's JIT picks every concrete class up.
const PILL: Record<CategoryKey, string> = {
  animation: 'bg-cat-animation-bg text-cat-animation',
  workflow: 'bg-cat-workflow-bg text-cat-workflow',
  cornerman: 'bg-cat-cornerman-bg text-cat-cornerman',
  break: 'bg-cat-break-bg text-cat-break',
};

const DOT: Record<CategoryKey, string> = {
  animation: 'bg-cat-animation',
  workflow: 'bg-cat-workflow',
  cornerman: 'bg-cat-cornerman',
  break: 'bg-cat-break',
};

export function CategoryBadge({ category, compact = false }: CategoryBadgeProps) {
  const label = LABELS[category];

  if (compact) {
    return (
      <span
        data-category={category}
        aria-label={`Category: ${label}`}
        className={`inline-block size-2 rounded-full ${DOT[category]}`}
      />
    );
  }

  return (
    <span
      data-category={category}
      aria-label={`Category: ${label}`}
      className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${PILL[category]}`}
    >
      {label}
    </span>
  );
}
