import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: simple crypto polyfill for browser
const cryptoPolyfill = `
export function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    open: false,
  },
  resolve: {
    alias: {
      crypto: '/src/utils/cryptoPolyfill.ts',
    },
  },
});
