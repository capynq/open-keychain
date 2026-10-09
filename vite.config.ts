import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { customizerBootPlugin } from './scripts/build/customizer-boot-plugin.ts';

const appEnvironment =
  process.env.CONTEXT === 'production'
    ? 'production'
    : process.env.NODE_ENV === 'development'
      ? 'development'
      : 'preview';
const appVersion = process.env.GITHUB_SHA ?? process.env.VITE_APP_VERSION ?? '';

export default defineConfig({
  define: {
    __OPEN_KEYCHAIN_ENV__: JSON.stringify(appEnvironment),
    __OPEN_KEYCHAIN_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), customizerBootPlugin()],
  cacheDir: process.env.OPEN_KEYCHAIN_VITE_CACHE_DIR,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '@/entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
      '@/features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@/infrastructure': fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@/shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@/types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@/widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  server: { strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        customizerBootStyles: fileURLToPath(
          new URL('./src/app/boot/customizer-boot-styles.ts', import.meta.url),
        ),
      },
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
