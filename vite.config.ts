import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { applyBrand } from './src/brandHtml';

// Fills the {{BRAND_*}} marks of index.html from src/brand.ts (one place to rename the product).
const brandHtml = (): Plugin => ({ name: 'brand-html', transformIndexHtml: applyBrand });


// `vite build --mode appsscript` is the old single-file build for the Google Apps Script
// web app (removed with the rest of that code in the closing phase).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [brandHtml()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build:
    mode === 'appsscript'
      ? { assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false, modulePreload: false }
      : {
          // Phaser is big and rarely changes: its own file keeps it cached between releases.
          rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
        },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
}));
