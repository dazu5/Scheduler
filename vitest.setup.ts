// Extends Vitest's `expect` with @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, …) and unmounts every
// rendered component after each test so subsequent tests start from a
// clean DOM. RTL's auto-cleanup only fires under vitest's globals
// mode; we keep globals off (explicit imports read cleaner), so this
// hook is what prevents render() output from stacking across tests.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
