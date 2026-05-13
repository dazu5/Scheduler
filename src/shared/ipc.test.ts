// Tests for the TS-side IPC wrapper. Asserts each wrapper's
// observable contract — what Tauri command it invokes, with what
// argument shape, and what value it returns — by mocking the
// `invoke` boundary. The Rust side is covered by `cargo test`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above imports — invoke is mocked from this
// module's perspective regardless of import order.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { addSession, listSessions, updateSession } from './ipc';

describe('addSession (IPC wrapper)', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('invokes the "add_session" Tauri command with the input nested under `input`', async () => {
    vi.mocked(invoke).mockResolvedValue('uuid-1');

    const id = await addSession({
      dateKey: '2026-05-13',
      category: 'animation',
      label: 'LR · AI Animation',
      startMin: 480,
      endMin: 660,
      notes: 'warm-up scene',
    });

    expect(invoke).toHaveBeenCalledWith('add_session', {
      input: {
        dateKey: '2026-05-13',
        category: 'animation',
        label: 'LR · AI Animation',
        startMin: 480,
        endMin: 660,
        notes: 'warm-up scene',
      },
    });
    expect(id).toBe('uuid-1');
  });

  it('passes a null notes field through unchanged', async () => {
    vi.mocked(invoke).mockResolvedValue('uuid-2');

    await addSession({
      dateKey: '2026-05-13',
      category: 'workflow',
      label: 'LR · AI Workflow',
      startMin: 540,
      endMin: 600,
      notes: null,
    });

    const args = vi.mocked(invoke).mock.calls[0][1] as { input: { notes: unknown } };
    expect(args.input.notes).toBeNull();
  });
});

describe('listSessions (IPC wrapper)', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('invokes "list_sessions" with the start + end dateKeys flat (not nested)', async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    await listSessions({ start: '2025-01-13', end: '2025-01-19' });

    expect(invoke).toHaveBeenCalledWith('list_sessions', {
      start: '2025-01-13',
      end: '2025-01-19',
    });
  });

  it('returns the array of Sessions verbatim', async () => {
    const fakeSession = {
      id: 'x',
      dateKey: '2025-01-13',
      category: 'animation',
      label: 'foo',
      startMin: 540,
      endMin: 600,
      notes: null,
      done: false,
      adjusted: false,
      overnightLinkId: null,
      createdAt: 0,
      updatedAt: 0,
    };
    vi.mocked(invoke).mockResolvedValue([fakeSession]);

    const result = await listSessions({ start: '2025-01-13', end: '2025-01-19' });

    expect(result).toEqual([fakeSession]);
  });
});

describe('updateSession (IPC wrapper)', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('invokes "update_session" with { id, input } and forwards audit + overnight', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await updateSession('session-123', {
      category: 'animation',
      label: 'Updated label',
      startMin: 540,
      endMin: 1440,
      notes: null,
      audit: [{ field: 'label', oldValue: 'old', newValue: 'Updated label' }],
      overnightSpill: { nextDateKey: '2025-01-14', endMin: 60 },
    });

    expect(invoke).toHaveBeenCalledWith('update_session', {
      id: 'session-123',
      input: {
        category: 'animation',
        label: 'Updated label',
        startMin: 540,
        endMin: 1440,
        notes: null,
        audit: [{ field: 'label', oldValue: 'old', newValue: 'Updated label' }],
        overnightSpill: { nextDateKey: '2025-01-14', endMin: 60 },
      },
    });
  });

  it('passes overnightSpill: null for same-day edits', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await updateSession('session-123', {
      category: 'workflow',
      label: 'Same day',
      startMin: 540,
      endMin: 600,
      notes: null,
      audit: [],
      overnightSpill: null,
    });

    const args = vi.mocked(invoke).mock.calls[0][1] as { input: { overnightSpill: unknown } };
    expect(args.input.overnightSpill).toBeNull();
  });
});
