import { existsSync, readdirSync, statSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Packs de textures téléchargeables : public/packs/<adresse-de-l-espace>/<Nom>.zip
// (servi tel quel par GitHub Pages ; la fiche du mode affiche le bouton « Télécharger le pack »).
function packs() {
  const root = new URL('./public/packs/', import.meta.url).pathname;
  const out: Record<string, { file: string; size: number }> = {};
  if (!existsSync(root)) return out;
  for (const slug of readdirSync(root)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !statSync(root + slug).isDirectory()) continue;
    const zip = readdirSync(root + slug).filter((f) => /^[\w.-]+\.zip$/i.test(f)).sort()[0];
    if (zip) out[slug] = { file: zip, size: statSync(`${root}${slug}/${zip}`).size };
  }
  return out;
}

// Le site est servi par GitHub Pages sous /TsukiAlmanach/ (ou à la racine d'un domaine à soi : ALMANACH_BASE=/).
export default defineConfig({
  base: process.env.ALMANACH_BASE ?? '/TsukiAlmanach/',
  plugins: [react()],
  define: { __ALMANACH_PACKS__: JSON.stringify(packs()) },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});
