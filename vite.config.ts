import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le site est servi par GitHub Pages sous /TsukiAlmanach/ (ou à la racine d'un domaine à soi : ALMANACH_BASE=/).
export default defineConfig({
  base: process.env.ALMANACH_BASE ?? '/TsukiAlmanach/',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});
