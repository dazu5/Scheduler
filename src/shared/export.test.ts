import { describe, expect, it } from 'vitest';
import { toCsv, toJson } from './export';
import type { Session } from './ipc';

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  dateKey: '2026-05-14',
  category: 'animation',
  label: 'work',
  startMin: 540,
  endMin: 600,
  notes: null,
  done: false,
  adjusted: false,
  overnightLinkId: null,
  createdAt: 1234,
  updatedAt: 1234,
  ...overrides,
});

describe('toCsv', () => {
  it('emits a header row followed by one data row per Session', () => {
    const csv = toCsv([session({ id: 'a' }), session({ id: 'b' })]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('id,dateKey,category,label');
  });

  it('quotes + escapes fields containing commas, quotes, or newlines', () => {
    const csv = toCsv([session({ id: 'tricky', label: 'has "quotes", a comma\nand newline' })]);
    expect(csv).toContain('"has ""quotes"", a comma\nand newline"');
  });

  it('serialises null fields as empty', () => {
    const csv = toCsv([session({ id: 'plain', notes: null, overnightLinkId: null })]);
    // Two empty fields between commas where notes and overnight_link_id sit.
    expect(csv).toMatch(/plain,2026-05-14,animation,work,540,600,,false,false,,1234,1234/);
  });
});

describe('toJson', () => {
  it('returns parseable JSON that round-trips the input', () => {
    const sessions = [session({ id: 'a' }), session({ id: 'b' })];
    const parsed = JSON.parse(toJson(sessions));
    expect(parsed).toEqual(sessions);
  });

  it('uses 2-space indentation', () => {
    const out = toJson([session()]);
    expect(out).toContain('  "id": "s1"');
  });
});
