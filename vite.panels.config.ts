import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// PERF-ISLANDS-SPLIT-001: second, independent lib build for the "panels"
// islands (Settings / Package Picker / Export Options / Layout Picker).
// Kept as its own config (rather than a multi-entry rollupOptions.input)
// because Vite's `lib` + `iife` mode — the proven, already-working path for
// the core bundle — only supports a single entry per invocation. Two
// sequential `vite build` runs (see package.json's "build" script) give an
// independent, self-contained antcv-react-islands-panels.js that
// src/main-core.tsx loads lazily at runtime. See src/main-panels.tsx for
// why these four islands are safe to defer.
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
    }),
  ],
  build: {
    outDir: resolve(__dirname, 'pwa'),
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/main-panels.tsx'),
      name: 'AntcvReactPanels',
      formats: ['iife'],
      fileName: () => 'antcv-react-islands-panels.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
        },
        assetFileNames: (asset) =>
          asset.name && asset.name.endsWith('.css')
            ? 'antcv-react-islands-panels.css'
            : 'assets/[name][extname]',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
});
