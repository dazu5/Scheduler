// Behaviour tests for the useTick() hook — the React side of the
// 1 Hz timer:tick contract. The hook returns the latest tick
// payload (active / next / nowMin / elapsed / planned) and
// refreshes whenever Rust emits `timer:tick`. Without a Tauri
// runtime (i.e. during vitest), it falls back to a JS-side
// setInterval that recomputes the same payload locally from the
// supplied sessions every second.

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../shared/ipc';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { listen } from '@tauri-apps/api/event';
import { useTick } from './useTick';

function mk(overrides: Partial<Session> = {}): Session {
  return {
    id: 's',
    dateKey: '2026-05-13',
    category: 'animation',
    label: 'work',
    startMin: 540,
    endMin: 600,
    notes: null,
    done: false,
    adjusted: false,
    overnightLinkId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// Wed 2026-05-13 13:30
const NOW = new Date(2026, 4, 13, 13, 30, 0);

describe('useTick', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
    vi.mocked(listen).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the JS-derived tick payload immediately on first render', () => {
    const sessions = [mk({ id: 'live', startMin: 13 * 60, endMin: 14 * 60 })];
    const { result, unmount } = renderHook(() => useTick(sessions));
    expect(result.current.active?.id).toBe('live');
    expect(result.current.nowMin).toBe(13 * 60 + 30);
    unmount();
  });

  it('subscribes to the Tauri "timer:tick" event on mount', () => {
    const { unmount } = renderHook(() => useTick([]));
    expect(listen).toHaveBeenCalledWith('timer:tick', expect.any(Function));
    unmount();
  });
});
