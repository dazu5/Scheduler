// Behaviour tests for the `migration` pure module — `importV4(json)`
// parses the v4 localStorage shape emitted by `weekly_scheduler.html`
// and returns SQLite-shaped rows. Also covers the v2 (legacy seed)
// and v3 (`tag` field) chains, the v3→v4 `tag → category` rename, and
// idempotency on re-import (re-running the importer on the same input
// produces the same Session ids — so an INSERT-OR-IGNORE in the IPC
// layer never creates duplicates).
//
// The module is pure — no IO, no DOM, no Tauri. Persistence is the
// responsibility of the Rust `import_json` command (slice #12 wires
// them together).

import { describe, expect, it } from 'vitest';
import { type ImportResult, importV4 } from './migration';

// --- v4 shape (the canonical post-2026-05-13 localStorage payload) ---

describe('importV4 — v4 shape', () => {
  it('returns an empty result for an empty payload', () => {
    const result = importV4(JSON.stringify({ version: 4, days: {}, offDays: {} }));
    expect(result.sessions).toEqual([]);
    expect(result.offDays).toEqual([]);
  });

  it('parses a single v4 Session into a SessionRow with category preserved', () => {
    const json = JSON.stringify({
      version: 4,
      days: {
        '2026-05-13': [
          {
            id: 'sess-abc',
            category: 'animation',
            label: 'LR · AI Animation',
            startMin: 480,
            endMin: 660,
            notes: 'warm-up scene',
            done: true,
            adjusted: false,
          },
        ],
      },
      offDays: {},
    });

    const { sessions } = importV4(json);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({
      id: 'sess-abc',
      dateKey: '2026-05-13',
      category: 'animation',
      label: 'LR · AI Animation',
      startMin: 480,
      endMin: 660,
      notes: 'warm-up scene',
      done: true,
      adjusted: false,
    });
  });

  it('flattens multiple days into one Session array tagged with each dateKey', () => {
    const json = JSON.stringify({
      version: 4,
      days: {
        '2026-05-13': [{ id: 'a', category: 'animation', label: 'A', startMin: 540, endMin: 600 }],
        '2026-05-14': [
          { id: 'b', category: 'workflow', label: 'B', startMin: 600, endMin: 660 },
          { id: 'c', category: 'cornerman', label: 'C', startMin: 720, endMin: 780 },
        ],
      },
      offDays: {},
    });

    const { sessions } = importV4(json);
    expect(sessions).toHaveLength(3);
    expect(sessions.map((s) => `${s.dateKey}:${s.id}`)).toEqual([
      '2026-05-13:a',
      '2026-05-14:b',
      '2026-05-14:c',
    ]);
  });

  it('coerces missing/default optional fields (notes, done, adjusted)', () => {
    const json = JSON.stringify({
      version: 4,
      days: {
        '2026-05-13': [
          { id: 'x', category: 'break', label: 'short break', startMin: 720, endMin: 735 },
        ],
      },
      offDays: {},
    });

    const { sessions } = importV4(json);
    expect(sessions[0].notes).toBe('');
    expect(sessions[0].done).toBe(false);
    expect(sessions[0].adjusted).toBe(false);
  });

  it('parses off-Days into OffDayRow with reason preserved', () => {
    const json = JSON.stringify({
      version: 4,
      days: {},
      offDays: {
        '2026-05-13': { reason: 'sick day' },
        '2026-05-14': { reason: '' }, // empty reason coerces to a placeholder
      },
    });

    const { offDays } = importV4(json);
    expect(offDays).toHaveLength(2);
    expect(offDays).toContainEqual({ dateKey: '2026-05-13', reason: 'sick day' });
    expect(offDays).toContainEqual({ dateKey: '2026-05-14', reason: 'No reason given' });
  });
});

// --- v3 shape — has `tag` instead of `category`, no offDays --------

describe('importV4 — v3 shape with `tag → category` rename', () => {
  it('migrates v3 `tag` to v4 `category` on Sessions', () => {
    const json = JSON.stringify({
      version: 3,
      days: {
        '2025-01-13': [
          {
            id: 'old-1',
            tag: 'animation',
            label: 'legacy',
            startMin: 540,
            endMin: 600,
            done: false,
          },
        ],
      },
    });

    const { sessions } = importV4(json);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].category).toBe('animation');
  });

  it('v3 inputs produce no offDays (the field did not exist)', () => {
    const json = JSON.stringify({
      version: 3,
      days: {
        '2025-01-13': [{ id: 'x', tag: 'workflow', label: 'w', startMin: 540, endMin: 600 }],
      },
    });

    const { offDays } = importV4(json);
    expect(offDays).toEqual([]);
  });
});

// --- v2 shape — legacy seed format, same shape as v3 minus version --

describe('importV4 — v2 shape (legacy seed)', () => {
  it('parses a v2 payload like a v3 payload (tag → category)', () => {
    const json = JSON.stringify({
      version: 2,
      days: {
        '2024-06-01': [
          {
            id: 'ancient-1',
            tag: 'cornerman',
            label: 'old seed',
            startMin: 600,
            endMin: 660,
          },
        ],
      },
    });

    const { sessions } = importV4(json);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].category).toBe('cornerman');
    expect(sessions[0].label).toBe('old seed');
  });
});

// --- idempotency on re-import ---------------------------------------

describe('importV4 — idempotency', () => {
  it('returns identical Session ids when called twice on the same input', () => {
    // The migration module preserves the v4 Session id verbatim, so
    // the Rust side can use INSERT-OR-IGNORE on (id) to dedupe.
    const json = JSON.stringify({
      version: 4,
      days: {
        '2026-05-13': [
          { id: 'stable-id', category: 'animation', label: 'X', startMin: 540, endMin: 600 },
        ],
      },
      offDays: {},
    });

    const a: ImportResult = importV4(json);
    const b: ImportResult = importV4(json);

    expect(a.sessions[0].id).toBe(b.sessions[0].id);
    expect(a.sessions[0].id).toBe('stable-id');
  });
});

// --- malformed input safety ------------------------------------------

describe('importV4 — malformed input', () => {
  it('throws a descriptive error on invalid JSON', () => {
    expect(() => importV4('{not-json')).toThrowError(/invalid json/i);
  });

  it('returns empty result for an object missing `days`', () => {
    const result = importV4(JSON.stringify({ version: 4 }));
    expect(result.sessions).toEqual([]);
    expect(result.offDays).toEqual([]);
  });
});
