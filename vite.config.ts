import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-three-core', test: /[\\/]node_modules[\\/]three[\\/]build[\\/]/ },
            { name: 'vendor-three-addons', test: /[\\/]node_modules[\\/]three[\\/]examples[\\/]/ },
            { name: 'vendor-three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: 'vendor-manifold', test: /[\\/]node_modules[\\/]manifold-3d[\\/]/ },
            { name: 'vendor-opentype', test: /[\\/]node_modules[\\/]opentype\.js[\\/]/ },
            { name: 'vendor-posthog', test: /[\\/]node_modules[\\/]posthog-js[\\/]/ },
          ],
        },
      },
    },
  },
});
