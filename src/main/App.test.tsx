// Behaviour tests for <App /> — the integration point that wires
// WeekGrid (click input + Session blocks) and NewSessionModal (form
// output) to the IPC layer (addSession + listSessions).
// Component-level behaviour is tested in their own files; here we
// assert the user-visible flow:
//
//   on mount → listSessions for the current week
//   click empty cell → modal opens
//   Save → addSession → close modal → refresh listSessions
//   Cancel → modal closes

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shared/ipc', () => ({
  addSession: vi.fn(),
  listSessions: vi.fn(),
}));

import { addSession, listSessions } from '../shared/ipc';
import { App } from './App';

describe('<App />', () => {
  beforeEach(() => {
    vi.mocked(addSession).mockReset();
    vi.mocked(listSessions).mockReset();
    vi.mocked(addSession).mockResolvedValue('test-uuid');
    vi.mocked(listSessions).mockResolvedValue([]);
  });

  it('renders the WeekGrid on mount', async () => {
    render(<App />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));
  });

  it('loads Sessions for the current week via listSessions on mount', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    // The range must be { start: <Monday>, end: <Sunday> } — exact
    // dates depend on test execution time, so we just assert shape.
    const callArg = vi.mocked(listSessions).mock.calls[0][0];
    expect(callArg).toHaveProperty('start');
    expect(callArg).toHaveProperty('end');
    expect(callArg.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArg.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the New Session modal when a grid cell is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('cell')[0]);
    expect(screen.getByRole('dialog', { name: /new session/i })).toBeInTheDocument();
  });

  it('calls addSession then re-fetches Sessions when the user Saves', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole('cell')[0]);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'Integration test session' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(addSession).toHaveBeenCalledTimes(1);
    expect(addSession).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Integration test session' }),
    );

    // After save: listSessions fires again to refresh the grid.
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
  });

  it('closes the modal when Cancel is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('cell')[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
