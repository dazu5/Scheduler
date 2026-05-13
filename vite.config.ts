import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tauri 2 dev-server settings: fixed port (5173) so tauri.conf.json's
// devUrl matches, clearScreen off so cargo + vite output coexist
// readably in the same terminal, and the TAURI_ env-prefix so Tauri's
// build-time env vars reach the frontend via `import.meta.env`.
//
// Tailwind v4 uses a Vite plugin (no PostCSS) — design tokens live
// in `src/styles.css` under `@theme`; see issue #18 chunk 1.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
