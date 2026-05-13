import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    // Exclude agent worktrees so vitest only discovers tests from
    // the primary checkout — otherwise it crawls into duplicate copies
    // under `.claude/worktrees/` and runs every test 4x.
    exclude: ['node_modules', 'dist', '.claude/worktrees/**'],
  },
});
