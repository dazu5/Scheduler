// Behaviour tests for <App /> — the integration point that wires
// WeekGrid (click input + Session blocks) and SessionEditor (form
// output) to the IPC layer (addSession, listSessions, updateSession).
// Component-level behaviour is tested in their own files; here we
// assert the user-visible end-to-end flows.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shared/ipc', () => ({
  addSession: vi.fn(),
  listSessions: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  toggleDone: vi.fn(),
  duplicateSession: vi.fn(),
  undoCommand: vi.fn(),
  redoCommand: vi.fn(),
  hasOnboarded: vi.fn(),
  setOnboarded: vi.fn(),
  importJsonFromPath: vi.fn(),
  listOffDays: vi.fn(),
  markDayOff: vi.fn(),
  unmarkDayOff: vi.fn(),
  exportToPath: vi.fn(),
  showPill: vi.fn(),
  hidePill: vi.fn(),
  tickKeystroke: vi.fn(),
  tickClick: vi.fn(),
  getActivityCounts: vi.fn(),
  resetActivityCounts: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
import {
  type Session,
  addSession,
  deleteSession,
  duplicateSession,
  getActivityCounts,
  hasOnboarded,
  importJsonFromPath,
  listOffDays,
  listSessions,
  markDayOff,
  redoCommand,
  setOnboarded,
  tickClick,
  tickKeystroke,
  toggleDone,
  undoCommand,
  unmarkDayOff,
  updateSession,
} from '../shared/ipc';
import { App } from './App';

const oneSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  dateKey: '2026-05-13',
  category: 'animation',
  label: 'Test session',
  startMin: 540,
  endMin: 600,
  notes: null,
  done: false,
  adjusted: false,
  overnightLinkId: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('<App />', () => {
  beforeEach(() => {
    vi.mocked(addSession).mockReset().mockResolvedValue('test-uuid');
    vi.mocked(listSessions).mockReset().mockResolvedValue([]);
    vi.mocked(updateSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(deleteSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(toggleDone).mockReset().mockResolvedValue(undefined);
    vi.mocked(duplicateSession).mockReset().mockResolvedValue('dup-uuid');
    vi.mocked(undoCommand).mockReset().mockResolvedValue(null);
    vi.mocked(redoCommand).mockReset().mockResolvedValue(null);
    // Existing tests assume onboarding has already been completed —
    // they exercise WeekGrid/SessionEditor flows, not the first-launch
    // prompt. The first-launch prompt is covered by its dedicated
    // describe block at the bottom of this file.
    vi.mocked(hasOnboarded).mockReset().mockResolvedValue(true);
    vi.mocked(setOnboarded).mockReset().mockResolvedValue(undefined);
    vi.mocked(importJsonFromPath).mockReset().mockResolvedValue({ sessions: 0, offDays: 0 });
    vi.mocked(listOffDays).mockReset().mockResolvedValue([]);
    vi.mocked(markDayOff).mockReset().mockResolvedValue(undefined);
    vi.mocked(unmarkDayOff).mockReset().mockResolvedValue(undefined);
    vi.mocked(getActivityCounts)
      .mockReset()
      .mockResolvedValue({ dateKey: '2026-05-14', keystrokes: 0, clicks: 0 });
    // The useActivityTracker hook attaches document.keydown / mousedown
    // listeners that fire tickKeystroke / tickClick on every event.
    // Several tests dispatch synthetic key events; if these mocks
    // returned undefined, the hook's `.catch()` would crash.
    vi.mocked(tickKeystroke).mockReset().mockResolvedValue(undefined);
    vi.mocked(tickClick).mockReset().mockResolvedValue(undefined);
    vi.mocked(open).mockReset();
  });

  it('renders the WeekGrid on mount', async () => {
    render(<App />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));
  });

  it('loads Sessions for the current week via listSessions on mount', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    const callArg = vi.mocked(listSessions).mock.calls[0][0];
    expect(callArg.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArg.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the create-mode editor when an empty cell is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    expect(screen.getByRole('dialog', { name: /new session/i })).toBeInTheDocument();
  });

  it('opens the edit-mode editor when a saved Session block is clicked', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      {
        id: 'session-1',
        dateKey: '2026-05-13',
        category: 'animation',
        label: 'Click me',
        startMin: 540,
        endMin: 600,
        notes: null,
        done: false,
        adjusted: false,
        overnightLinkId: null,
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    render(<App />);
    const block = await screen.findByText('Click me');
    fireEvent.click(block);

    expect(screen.getByRole('dialog', { name: /edit session/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toHaveValue('Click me');
  });

  it('calls addSession then re-fetches Sessions when create-Save fires', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'Integration test session' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(addSession).toHaveBeenCalledTimes(1);
    expect(addSession).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Integration test session' }),
    );
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('calls updateSession then re-fetches when edit-Save fires', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      {
        id: 'session-edit',
        dateKey: '2026-05-13',
        category: 'animation',
        label: 'before',
        startMin: 540,
        endMin: 600,
        notes: null,
        done: false,
        adjusted: false,
        overnightLinkId: null,
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByText('before'));
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'after' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(updateSession).toHaveBeenCalledWith(
      'session-edit',
      expect.objectContaining({ label: 'after' }),
    );
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('calls deleteSession then re-fetches when the 🗑 button is clicked', async () => {
    vi.mocked(listSessions).mockResolvedValue([oneSession({ label: 'kill me' })]);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByLabelText('Delete kill me'));

    expect(deleteSession).toHaveBeenCalledWith('session-1');
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('calls toggleDone then re-fetches when the done checkbox is clicked', async () => {
    vi.mocked(listSessions).mockResolvedValue([oneSession({ label: 'mark me' })]);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByLabelText('Mark mark me done'));

    expect(toggleDone).toHaveBeenCalledWith('session-1');
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('calls duplicateSession then re-fetches when the ⎘ button is clicked', async () => {
    const src = oneSession({ label: 'copy me' });
    vi.mocked(listSessions).mockResolvedValue([src]);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByLabelText('Duplicate copy me'));

    expect(duplicateSession).toHaveBeenCalledWith(src);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('closes the modal when Cancel is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fires a "Saved:" success toast after a successful create', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'Toasted session' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Saved: Toasted session');
  });

  it('fires a "Deleted:" success toast after a successful delete', async () => {
    vi.mocked(listSessions).mockResolvedValue([oneSession({ label: 'bye' })]);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByLabelText('Delete bye'));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Deleted: bye');
  });

  // --- first-launch onboarding flow --------------------------------

  it('shows the onboarding modal on mount when hasOnboarded() is false', async () => {
    vi.mocked(hasOnboarded).mockResolvedValueOnce(false);
    render(<App />);

    expect(
      await screen.findByRole('dialog', { name: /import from weekly_scheduler\.html/i }),
    ).toBeInTheDocument();
  });

  it('does NOT show the onboarding modal when hasOnboarded() returns true', async () => {
    vi.mocked(hasOnboarded).mockResolvedValueOnce(true);
    render(<App />);
    await waitFor(() => expect(hasOnboarded).toHaveBeenCalled());

    // Give the modal a chance to appear if it were going to.
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole('dialog', { name: /import from weekly_scheduler\.html/i }),
    ).not.toBeInTheDocument();
  });

  it('calls setOnboarded(true) after the user clicks Skip on the first-launch modal', async () => {
    vi.mocked(hasOnboarded).mockResolvedValueOnce(false);
    render(<App />);
    const dialog = await screen.findByRole('dialog', {
      name: /import from weekly_scheduler\.html/i,
    });

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(setOnboarded).toHaveBeenCalledWith(true));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('calls setOnboarded(true) and refreshes Sessions after a successful import', async () => {
    vi.mocked(hasOnboarded).mockResolvedValueOnce(false);
    vi.mocked(open).mockResolvedValue('/tmp/sched.json');
    vi.mocked(importJsonFromPath).mockResolvedValueOnce({ sessions: 5, offDays: 1 });

    render(<App />);
    await screen.findByRole('dialog', {
      name: /import from weekly_scheduler\.html/i,
    });

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(setOnboarded).toHaveBeenCalledWith(true));
    // listSessions fires once on mount + once on import-complete refresh.
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('Header exposes a "Settings" button that re-opens the import modal', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(
      screen.getByRole('dialog', { name: /import from weekly_scheduler\.html/i }),
    ).toBeInTheDocument();
  });

  it('Settings → Skip does NOT call setOnboarded again (already onboarded)', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    // The Settings re-open path closes the modal without writing the
    // onboarded flag again — it's already set.
    expect(setOnboarded).not.toHaveBeenCalled();
  });

  it('fires an error toast when a mutation fails', async () => {
    vi.mocked(addSession).mockRejectedValueOnce(new Error('disk full'));
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'will fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/couldn['’]t save/i);
    expect(toast).toHaveAttribute('data-variant', 'error');
  });

  // -------------------------------------------------------------------
  // Slice 5 — Undo / Redo keyboard shortcuts
  // -------------------------------------------------------------------

  it('calls undoCommand when Ctrl+Z is pressed', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() => expect(undoCommand).toHaveBeenCalledTimes(1));
  });

  it('calls redoCommand when Ctrl+Shift+Z is pressed', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(redoCommand).toHaveBeenCalledTimes(1));
    expect(undoCommand).not.toHaveBeenCalled();
  });

  it('calls redoCommand when Ctrl+Y is pressed (alternate redo binding)', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });

    await waitFor(() => expect(redoCommand).toHaveBeenCalledTimes(1));
  });

  it('fires a "Undid: <label>" toast and re-fetches Sessions after Ctrl+Z', async () => {
    vi.mocked(undoCommand).mockResolvedValueOnce('edit Session');
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Undid: edit Session');
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('fires a "Redid: <label>" toast and re-fetches Sessions after Ctrl+Shift+Z', async () => {
    vi.mocked(redoCommand).mockResolvedValueOnce('add Session');
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Redid: add Session');
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('does not toast when undoCommand returns null (stack was empty)', async () => {
    vi.mocked(undoCommand).mockResolvedValueOnce(null);
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // give microtasks a beat to settle without forcing a wait on a
    // toast that should never appear
    await waitFor(() => expect(undoCommand).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('suppresses Ctrl+Z while the SessionEditor modal is open', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    // Open the editor modal — clicking any empty cell does it.
    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(undoCommand).not.toHaveBeenCalled();
  });

  it('suppresses Ctrl+Z while an input is focused (typing in the editor)', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByLabelText(/^\d{4}-\d{2}-\d{2} 8 AM$/)[0]);
    const labelInput = screen.getByLabelText(/label/i) as HTMLInputElement;
    labelInput.focus();
    fireEvent.keyDown(labelInput, { key: 'z', ctrlKey: true });

    expect(undoCommand).not.toHaveBeenCalled();
  });
});
