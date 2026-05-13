import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcut } from './useKeyboardShortcut';

function Harness({
  shortcut,
  options,
  onFire,
}: {
  shortcut: string;
  options?: Parameters<typeof useKeyboardShortcut>[2];
  onFire: () => void;
}) {
  useKeyboardShortcut(shortcut, onFire, options);
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="textarea" />
    </div>
  );
}

afterEach(() => {
  // Clean up any orphan dialogs left over from tests that mounted one.
  for (const d of document.querySelectorAll('[role="dialog"]')) {
    d.remove();
  }
});

describe('useKeyboardShortcut', () => {
  it('fires the handler when the matching key is pressed', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not fire on a different key', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('matches keys case-insensitively (t vs T)', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="t" onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'T' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('skips when an input element is focused', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" onFire={onFire} />);
    const input = screen.getByTestId('text-input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('skips when a textarea is focused', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" onFire={onFire} />);
    const ta = screen.getByTestId('textarea') as HTMLTextAreaElement;
    ta.focus();
    fireEvent.keyDown(ta, { key: 'ArrowLeft' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('honours allowInInputs=true even when an input is focused', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" options={{ allowInInputs: true }} onFire={onFire} />);
    const input = screen.getByTestId('text-input') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('skips when a modal is open', () => {
    const onFire = vi.fn();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    render(<Harness shortcut="ArrowLeft" onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('fires when ctrl modifier is required and pressed', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="z" options={{ ctrl: true }} onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not fire when ctrl is required but not pressed', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="z" options={{ ctrl: true }} onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'z' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not fire when ctrl is pressed but not required', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="z" onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('distinguishes Ctrl+Shift+Z from Ctrl+Z', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="z" options={{ ctrl: true, shift: true }} onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onFire).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('detaches when enabled=false', () => {
    const onFire = vi.fn();
    render(<Harness shortcut="ArrowLeft" options={{ enabled: false }} onFire={onFire} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onFire).not.toHaveBeenCalled();
  });
});
