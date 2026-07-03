import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Raiz do projeto sem barra final — precisa bater exatamente com os imports
// relativos dos testes, senão o alias vira outra instância de módulo (pool duplicado).
const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  root: 'dashboard',
  plugins: [react()],
  resolve: {
    // Alias `@/` do Next (tsconfig paths) p/ os testes vitest baterem em app/ e lib/.
    alias: { '@': ROOT }
  },
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
