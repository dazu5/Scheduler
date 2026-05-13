// Tests for the `adjustments` pure module. applySessionEdit is the
// diff engine: given a previous Session and a partial patch, it
// produces both the new Session shape AND the audit-log entries
// that record what changed.
//
// Tests assert the audit log's contract (which fields generate
// records, the old/new values, that no-op patches produce nothing)
// rather than the internal implementation. Notes are treated like
// any other tracked field — adding a note flips `adjusted` and
// generates one record.

import { describe, expect, it } from 'vitest';
import { applySessionEdit } from './adjustments';
import type { Session } from './ipc';

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    dateKey: '2025-01-13',
    category: 'animation',
    label: 'LR · AI Animation',
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

describe('applySessionEdit', () => {
  it('returns no audit entries when the patch is empty', () => {
    const prev = mkSession();
    const result = applySessionEdit(prev, {});
    expect(result.audit).toEqual([]);
    expect(result.adjusted).toBe(false);
  });

  it('returns no audit entries when patch values match prev unchanged', () => {
    const prev = mkSession({ label: 'unchanged', startMin: 540 });
    const result = applySessionEdit(prev, { label: 'unchanged', startMin: 540 });
    expect(result.audit).toEqual([]);
    expect(result.adjusted).toBe(false);
  });

  it('records one audit entry per changed tracked field', () => {
    const prev = mkSession({ category: 'animation', label: 'old' });
    const result = applySessionEdit(prev, {
      category: 'workflow',
      label: 'new',
    });

    expect(result.audit).toHaveLength(2);
    expect(result.audit).toContainEqual({
      field: 'category',
      oldValue: 'animation',
      newValue: 'workflow',
    });
    expect(result.audit).toContainEqual({
      field: 'label',
      oldValue: 'old',
      newValue: 'new',
    });
    expect(result.next.category).toBe('workflow');
    expect(result.next.label).toBe('new');
    expect(result.adjusted).toBe(true);
  });

  it('records startMin / endMin numeric changes with stringified values', () => {
    const prev = mkSession({ startMin: 540, endMin: 660 });
    const result = applySessionEdit(prev, { startMin: 600, endMin: 720 });

    expect(result.audit).toContainEqual({
      field: 'startMin',
      oldValue: '540',
      newValue: '600',
    });
    expect(result.audit).toContainEqual({
      field: 'endMin',
      oldValue: '660',
      newValue: '720',
    });
  });

  it('flips adjusted when notes are added to a Session that had none', () => {
    const prev = mkSession({ notes: null, adjusted: false });
    const result = applySessionEdit(prev, { notes: 'first note' });

    expect(result.audit).toContainEqual({
      field: 'notes',
      oldValue: null,
      newValue: 'first note',
    });
    expect(result.adjusted).toBe(true);
    expect(result.next.notes).toBe('first note');
  });

  it('keeps adjusted true once any prior change set it', () => {
    const prev = mkSession({ adjusted: true });
    const result = applySessionEdit(prev, {}); // empty patch
    expect(result.adjusted).toBe(true);
  });
});
