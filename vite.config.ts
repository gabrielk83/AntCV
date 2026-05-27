import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react({
      // React is loaded via UMD in pwa/index.html. Classic runtime compiles
      // JSX to React.createElement(...) calls against window.React — no
      // jsx-runtime import needed, no second React copy in the bundle.
      jsxRuntime: 'classic',
    }),
  ],
  build: {
    outDir: resolve(__dirname, 'pwa'),
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'AntcvReactIslands',
      formats: ['iife'],
      fileName: () => 'antcv-react-islands.js',
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
            ? 'antcv-react-islands.css'
            : 'assets/[name][extname]',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
});
