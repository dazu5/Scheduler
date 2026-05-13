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
}));

import { addSession, listSessions, updateSession } from '../shared/ipc';
import { App } from './App';

describe('<App />', () => {
  beforeEach(() => {
    vi.mocked(addSession).mockReset().mockResolvedValue('test-uuid');
    vi.mocked(listSessions).mockReset().mockResolvedValue([]);
    vi.mocked(updateSession).mockReset().mockResolvedValue(undefined);
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

    fireEvent.click(screen.getAllByRole('cell')[0]);
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

    fireEvent.click(screen.getAllByRole('cell')[0]);
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

  it('closes the modal when Cancel is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('cell')[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
