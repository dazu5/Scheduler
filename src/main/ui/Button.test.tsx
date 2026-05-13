import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('<Button />', () => {
  it('renders the children inside a button element', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to variant="secondary" and type="button"', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-variant', 'secondary');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'applies variant="%s" via data-variant',
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant);
    },
  );

  it('honours type="submit" override for form Save buttons', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('blocks clicks when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        nope
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
