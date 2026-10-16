/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tableau de bord de l'équipe du CIR (admin.revelation-sarl.com). Port 5174 (le site public est sur 5173).
// `@partage` pointe vers frontend/partage (code commun avec le site public).
// Ce dossier n'a pas de node_modules : `dedupe` force la résolution de ces paquets depuis frontend/tableau-de-bord.
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
    port: 5174,
    fs: { allow: ['..'] }, // autorise frontend/partage
  },
  preview: { port: 5174 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 400,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Les tests de ../partage sont lancés par frontend/site : on ne les rejoue pas ici.
    include: ['src/**/*.test.{js,jsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    unstubGlobals: true,
  },
});
