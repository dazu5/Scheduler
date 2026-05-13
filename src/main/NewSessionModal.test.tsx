// Behaviour tests for <NewSessionModal />. Asserts what the user can
// see and do — the modal exists with sensible defaults, Save builds
// the correct SessionInput, invalid input is blocked, Cancel exits.
// Doesn't reach into IPC or DB (cycle B verified that path); the
// modal's contract is "given a (dateKey, hour), call onSave with the
// matching SessionInput when the user clicks Save."

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewSessionModal } from './NewSessionModal';

const baseProps = {
  defaultDateKey: '2026-05-13',
  defaultHour: 9,
  onSave: () => {},
  onCancel: () => {},
};

describe('<NewSessionModal />', () => {
  it('opens with start/end times derived from the clicked hour', () => {
    render(<NewSessionModal {...baseProps} />);
    expect(screen.getByLabelText(/start/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/end/i)).toHaveValue('10:00');
  });

  it('calls onSave with the built SessionInput when Save is clicked', () => {
    const handler = vi.fn();
    render(<NewSessionModal {...baseProps} onSave={handler} />);

    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'LR · AI Animation' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(handler).toHaveBeenCalledWith({
      dateKey: '2026-05-13',
      category: 'animation',
      label: 'LR · AI Animation',
      startMin: 540,
      endMin: 600,
      notes: null,
    });
  });

  it('falls back to the Category name when the label is left blank', () => {
    const handler = vi.fn();
    render(<NewSessionModal {...baseProps} onSave={handler} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ label: 'animation' }));
  });

  it('refuses to save and shows an alert when end equals start (zero-length)', () => {
    const handler = vi.fn();
    render(<NewSessionModal {...baseProps} onSave={handler} />);

    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/after start/i);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const handler = vi.fn();
    render(<NewSessionModal {...baseProps} onCancel={handler} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
