import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('<Modal />', () => {
  it('renders the dialog with the title as accessible name', () => {
    render(
      <Modal title="Confirm action" onClose={() => {}}>
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
  });

  it('marks itself as aria-modal="true"', () => {
    render(
      <Modal title="X" onClose={() => {}}>
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose}>
        body
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose}>
        body
      </Modal>,
    );
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when dismissOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose} dismissOnBackdrop={false}>
        body
      </Modal>,
    );
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus to the first focusable element on mount', () => {
    render(
      <Modal title="X" onClose={() => {}}>
        <button type="button">first</button>
        <button type="button">second</button>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('renders children inside the dialog', () => {
    render(
      <Modal title="X" onClose={() => {}}>
        <p>some body copy</p>
      </Modal>,
    );
    expect(screen.getByText('some body copy')).toBeInTheDocument();
  });
});
