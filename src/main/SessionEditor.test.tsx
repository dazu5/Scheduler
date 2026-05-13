// Behaviour tests for <SessionEditor /> — the unified create + edit
// modal. Tests cover both modes plus the slice #4 additions: live
// overlap warning, overnight hint, audit-log on save, Esc cancel.

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../shared/ipc';
import { SessionEditor } from './SessionEditor';

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'existing-id',
    dateKey: '2025-01-13',
    category: 'animation',
    label: 'Existing Session',
    startMin: 540,
    endMin: 660,
    notes: null,
    done: false,
    adjusted: false,
    overnightLinkId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const baseHandlers = () => ({
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onCancel: vi.fn(),
});

describe('<SessionEditor /> create mode', () => {
  it('opens with start/end times derived from defaultHour', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    expect(screen.getByLabelText(/start/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/end/i)).toHaveValue('10:00');
  });

  it('calls onCreate with built SessionInput and null spill on a same-day Save', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'My session' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(h.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        dateKey: '2025-01-13',
        category: 'animation',
        label: 'My session',
        startMin: 540,
        endMin: 600,
        notes: null,
      }),
      null,
    );
  });

  it('passes overnightSpill describing the next-day spill on an overnight Save', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={18}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '01:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(h.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        startMin: 1080,
        endMin: 1440,
      }),
      { nextDateKey: '2025-01-14', endMin: 60 },
    );
  });

  it('falls back to the Category name when the label is left blank', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(h.onCreate).toHaveBeenCalledWith(expect.objectContaining({ label: 'animation' }), null);
  });

  it('refuses to save and shows an alert on zero-length input', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/after start/i);
    expect(h.onCreate).not.toHaveBeenCalled();
  });
});

describe('<SessionEditor /> edit mode', () => {
  it('prefills every field from the editing Session', () => {
    const h = baseHandlers();
    const editing = mkSession({
      label: 'Pre-existing',
      startMin: 720,
      endMin: 780,
      notes: 'note text',
    });
    render(
      <SessionEditor
        editing={editing}
        defaultDateKey="ignored"
        defaultHour={0}
        daySessions={[]}
        {...h}
      />,
    );
    expect(screen.getByLabelText(/label/i)).toHaveValue('Pre-existing');
    expect(screen.getByLabelText(/start/i)).toHaveValue('12:00');
    expect(screen.getByLabelText(/end/i)).toHaveValue('13:00');
    expect(screen.getByLabelText(/notes/i)).toHaveValue('note text');
  });

  it('calls onUpdate with audit entries describing each changed field', () => {
    const h = baseHandlers();
    const editing = mkSession({
      id: 'foo',
      label: 'old',
      startMin: 540,
      endMin: 600,
    });
    render(
      <SessionEditor
        editing={editing}
        defaultDateKey="ignored"
        defaultHour={0}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(h.onUpdate).toHaveBeenCalledWith(
      'foo',
      expect.objectContaining({
        label: 'new',
        audit: expect.arrayContaining([{ field: 'label', oldValue: 'old', newValue: 'new' }]),
        overnightSpill: null,
      }),
    );
  });

  it('produces no audit entries when no field changes', () => {
    const h = baseHandlers();
    const editing = mkSession({ id: 'foo' });
    render(
      <SessionEditor
        editing={editing}
        defaultDateKey="ignored"
        defaultHour={0}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const args = h.onUpdate.mock.calls[0][1] as { audit: unknown[] };
    expect(args.audit).toEqual([]);
  });

  it('emits an overnightSpill when an edit pushes end past midnight', () => {
    const h = baseHandlers();
    const editing = mkSession({ id: 'foo', startMin: 1080, endMin: 1200 });
    render(
      <SessionEditor
        editing={editing}
        defaultDateKey="ignored"
        defaultHour={0}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '01:00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(h.onUpdate).toHaveBeenCalledWith(
      'foo',
      expect.objectContaining({
        endMin: 1440,
        overnightSpill: { nextDateKey: '2025-01-14', endMin: 60 },
      }),
    );
  });
});

describe('<SessionEditor /> live warnings', () => {
  it('shows the overlap warning when daySessions collide with the entered range', () => {
    const h = baseHandlers();
    const other = mkSession({
      id: 'other',
      startMin: 570,
      endMin: 630,
      label: 'Existing block',
    });
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[other]}
        {...h}
      />,
    );
    expect(screen.getByTestId('overlap-warning')).toHaveTextContent('Existing block');
  });

  it('hides the overlap warning when no Session collides', () => {
    const h = baseHandlers();
    const other = mkSession({ id: 'other', startMin: 660, endMin: 720 });
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[other]}
        {...h}
      />,
    );
    expect(screen.queryByTestId('overlap-warning')).not.toBeInTheDocument();
  });

  it('shows the overnight hint when end < start', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={18}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '01:00' } });
    expect(screen.getByTestId('overnight-hint')).toHaveTextContent(/1:00 AM/i);
  });
});

describe('<SessionEditor /> keyboard + Cancel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Esc fires onCancel', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Cancel button fires onCancel', () => {
    const h = baseHandlers();
    render(
      <SessionEditor
        editing={null}
        defaultDateKey="2025-01-13"
        defaultHour={9}
        daySessions={[]}
        {...h}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });
});
