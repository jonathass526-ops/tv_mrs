import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    build: {
      target: 'es2015',
      chunkSizeWarningLimit: 2000,
      sourcemap: false,
    },
    plugins: [
      react(), 
      legacy({
        targets: ['defaults', 'not IE 11', 'chrome >= 51', 'safari >= 11'],
        modernPolyfills: false,
        renderLegacyChunks: true,
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
