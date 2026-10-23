import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const customLogger = createLogger();
const originalLoggerError = customLogger.error;
customLogger.error = (msg, options) => {
  if (
    typeof msg === 'string' &&
    (msg.includes('ws proxy socket error') ||
      msg.includes('ECONNABORTED') ||
      msg.includes('ECONNRESET'))
  ) {
    return;
  }
  originalLoggerError(msg, options);
};

export default defineConfig({
  customLogger,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const code = (err as any).code;
            if (code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'ECONNREFUSED') {
              return;
            }
            console.warn('[API Proxy]:', err.message);
          });
        },
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const code = (err as any).code;
            if (code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'EPIPE') {
              return;
            }
            console.warn('[WS Proxy]:', err.message);
          });
        },
      },
    },
  },
});
