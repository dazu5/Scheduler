import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryBadge } from './CategoryBadge';

describe('<CategoryBadge />', () => {
  it('renders the human-readable Category label by default', () => {
    render(<CategoryBadge category="animation" />);
    expect(screen.getByText('Animation')).toBeInTheDocument();
  });

  it('uses the matching data-category attribute for color hooks', () => {
    render(<CategoryBadge category="workflow" />);
    expect(screen.getByLabelText('Category: Workflow')).toHaveAttribute(
      'data-category',
      'workflow',
    );
  });

  it.each(['animation', 'workflow', 'cornerman', 'break'] as const)(
    'renders Category="%s" with the correct title-cased label',
    (cat) => {
      render(<CategoryBadge category={cat} />);
      const titleCased = cat[0].toUpperCase() + cat.slice(1);
      expect(screen.getByText(titleCased)).toBeInTheDocument();
    },
  );

  it('hides the label text in compact mode (color dot only)', () => {
    render(<CategoryBadge category="cornerman" compact />);
    expect(screen.queryByText('Cornerman')).not.toBeInTheDocument();
    // The accessible label still announces the Category for screen readers.
    expect(screen.getByLabelText('Category: Cornerman')).toBeInTheDocument();
  });
});
