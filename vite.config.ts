import { defineConfig } from 'vitest/config';

// `vite build --mode appsscript` makes the single-file build served by the Google
// Apps Script web app: every asset (sprites, fonts) is inlined as a data URI, and
// scripts/inline-html.mjs then folds the JS and CSS into backend/index.html.
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build:
    mode === 'appsscript'
      ? { assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false, modulePreload: false }
      : {},
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
}));
