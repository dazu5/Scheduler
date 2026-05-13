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
import {
  addSession,
  deleteSession,
  duplicateSession,
  hasOnboarded,
  importJson,
  importJsonFromPath,
  listSessions,
  setOnboarded,
  toggleDone,
  updateSession,
} from './ipc';
import type { Session } from './ipc';

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

describe('deleteSession / toggleDone IPC wrappers', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('deleteSession invokes "delete_session" with { id }', async () => {
    await deleteSession('abc-123');
    expect(invoke).toHaveBeenCalledWith('delete_session', { id: 'abc-123' });
  });

  it('toggleDone invokes "toggle_done" with { id }', async () => {
    await toggleDone('abc-123');
    expect(invoke).toHaveBeenCalledWith('toggle_done', { id: 'abc-123' });
  });
});

describe('importJson (IPC wrapper)', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('invokes "import_json" with the raw json string under `json` and returns the count summary', async () => {
    vi.mocked(invoke).mockResolvedValue({ sessions: 12, offDays: 2 });

    const result = await importJson('{"version":4,"days":{}}');

    expect(invoke).toHaveBeenCalledWith('import_json', { json: '{"version":4,"days":{}}' });
    expect(result).toEqual({ sessions: 12, offDays: 2 });
  });

  it('importJsonFromPath invokes "import_json_from_path" with the picked path', async () => {
    vi.mocked(invoke).mockResolvedValue({ sessions: 7, offDays: 0 });

    const r = await importJsonFromPath('/tmp/x.json');

    expect(invoke).toHaveBeenCalledWith('import_json_from_path', { path: '/tmp/x.json' });
    expect(r).toEqual({ sessions: 7, offDays: 0 });
  });
});

describe('hasOnboarded / setOnboarded IPC wrappers', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('hasOnboarded invokes "has_onboarded" with no args and returns the boolean', async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    const r = await hasOnboarded();
    expect(invoke).toHaveBeenCalledWith('has_onboarded');
    expect(r).toBe(false);
  });

  it('setOnboarded invokes "set_onboarded" with the boolean', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await setOnboarded(true);
    expect(invoke).toHaveBeenCalledWith('set_onboarded', { value: true });
  });
});

describe('duplicateSession', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue('new-uuid');
  });

  it("creates a new Session 15 minutes after the source's end, same fields", async () => {
    const source: Session = {
      id: 'src',
      dateKey: '2025-01-13',
      category: 'animation',
      label: 'original',
      startMin: 540,
      endMin: 660,
      notes: 'preserved',
      done: true,
      adjusted: false,
      overnightLinkId: null,
      createdAt: 0,
      updatedAt: 0,
    };

    const newId = await duplicateSession(source);

    expect(invoke).toHaveBeenCalledWith('add_session', {
      input: {
        dateKey: '2025-01-13',
        category: 'animation',
        label: 'original',
        startMin: 675, // 660 + 15
        endMin: 795, // 675 + (660 - 540)
        notes: 'preserved',
      },
    });
    expect(newId).toBe('new-uuid');
  });
});
