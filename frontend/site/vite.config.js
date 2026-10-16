/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Site public du CIR (visiteurs et clients). Port 5173.
// `@partage` pointe vers frontend/partage (code commun avec le tableau de bord).
// Ce dossier n'a pas de node_modules : `dedupe` force la résolution de ces paquets depuis frontend/site.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@partage': fileURLToPath(new URL('../partage', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'react-router', '@testing-library/react', '@testing-library/user-event'],
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // autorise frontend/partage
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 400,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', '../partage/**/*.test.{js,jsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
  },
});
