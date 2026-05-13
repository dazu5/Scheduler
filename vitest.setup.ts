// Extends Vitest's `expect` with @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, …) and unmounts every
// rendered component after each test so subsequent tests start from a
// clean DOM. RTL's auto-cleanup only fires under vitest's globals
// mode; we keep globals off (explicit imports read cleaner), so this
// hook is what prevents render() output from stacking across tests.
//
// Also hoists a default mock for `@tauri-apps/api/event` — useTick
// (and any future Tauri-event consumer) calls listen() during mount;
// without a mock that resolves the unlisten fn, the JS-side fallback
// works but tests log "[Vitest] Cannot find module" warnings.
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
});
