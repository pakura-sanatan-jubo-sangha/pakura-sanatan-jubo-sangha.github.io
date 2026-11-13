import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'disable-vite-hmr-websocket',
        apply: 'serve',
        enforce: 'post',
        transform(code, id) {
          if (
            (id.includes('/vite/dist/client/client.mjs') || id.includes('\\vite\\dist\\client\\client.mjs')) &&
            code.includes('transport.connect(createHMRHandler(handleMessage));')
          ) {
            return {
              code: code.replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket connection disabled */'
              ),
              map: null,
            };
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: false,
      ws: false,
      watch: null,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
  };
});
