import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri 2 dev-server settings: fixed port (5173) so tauri.conf.json's
// devUrl matches, clearScreen off so cargo + vite output coexist
// readably in the same terminal, and the TAURI_ env-prefix so Tauri's
// build-time env vars reach the frontend via `import.meta.env`.
//
// Two HTML entry points: `index.html` for the main scheduler window,
// `pill.html` for the issue #9 always-on-top pill. Each loads its own
// `src/*.tsx` entry so the pill bundle stays tiny and doesn't pull
// in the full main-window React tree.
//
// Tailwind v4 uses a Vite plugin (no PostCSS) — design tokens live
// in `src/styles.css` under `@theme`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    rollupOptions: {
      // Vite resolves these strings relative to the config dir, so
      // no `path.resolve` (and thus no `node:path` import) is needed.
      input: {
        main: 'index.html',
        pill: 'pill.html',
      },
    },
  },
});
