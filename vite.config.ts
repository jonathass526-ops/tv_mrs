import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    build: {
      target: 'es2015',
    },
    plugins: [
      react(), 
      legacy({
        targets: ['defaults', 'not IE 11', 'chrome >= 49', 'safari >= 10', 'samsung >= 7'],
        modernTargets: 'chrome >= 60',
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        modernPolyfills: true
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
