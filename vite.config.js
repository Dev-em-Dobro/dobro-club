import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dashboard',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/entrar': 'http://localhost:3001'
    }
  },
  test: {
    root: '.',
    // Vitest v4 removed `environmentMatchGlobs`. Default environment is node
    // (server tests under tests/**); dashboard test files opt into jsdom with a
    // `// @vitest-environment jsdom` header comment on their first line.
    environment: 'node'
  }
});
