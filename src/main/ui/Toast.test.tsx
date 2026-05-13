import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Harness({ children }: { children: React.ReactNode }) {
  return <ToastProvider duration={1000}>{children}</ToastProvider>;
}

function Trigger({
  kind = 'show',
  message,
}: { kind?: 'show' | 'success' | 'error'; message: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast[kind](message)}>
      fire
    </button>
  );
}

describe('<ToastProvider /> + useToast()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires a toast whose message renders as a role="status" element', () => {
    render(
      <Harness>
        <Trigger message="Saved: warm-up" />
      </Harness>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved: warm-up');
  });

  it('auto-dismisses after the duration elapses', () => {
    render(
      <Harness>
        <Trigger message="Bye" />
      </Harness>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Bye')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('dismisses immediately when the toast is clicked', () => {
    render(
      <Harness>
        <Trigger message="Click me" />
      </Harness>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Click me')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('status'));
    expect(screen.queryByText('Click me')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts simultaneously', () => {
    function Two() {
      const toast = useToast();
      return (
        <>
          <button type="button" onClick={() => toast.show('one')}>
            one
          </button>
          <button type="button" onClick={() => toast.show('two')}>
            two
          </button>
        </>
      );
    }
    render(
      <Harness>
        <Two />
      </Harness>,
    );
    fireEvent.click(screen.getByText('one'));
    fireEvent.click(screen.getByText('two'));

    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('tags success toasts via data-variant="success"', () => {
    render(
      <Harness>
        <Trigger kind="success" message="Saved!" />
      </Harness>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'success');
  });

  it('tags error toasts via data-variant="error"', () => {
    render(
      <Harness>
        <Trigger kind="error" message="Oh no" />
      </Harness>,
    );
    fireEvent.click(screen.getByText('fire'));
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'error');
  });

  it('throws an informative error when useToast() is called outside the provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    // Suppress React's expected-error console output for this case.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
