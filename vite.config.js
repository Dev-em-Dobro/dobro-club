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
    environmentMatchGlobs: [
      ['dashboard/**', 'jsdom'],
      ['tests/**', 'node']
    ]
  }
});
