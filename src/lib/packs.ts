// Packs de textures servis avec le site (public/packs/<espace>/<Nom>.zip), relevés à la construction.
declare const __ALMANACH_PACKS__: Record<string, { file: string; size: number }> | undefined;

const PACKS = typeof __ALMANACH_PACKS__ === 'undefined' ? {} : __ALMANACH_PACKS__;

export type Pack = { url: string; file: string; size: string };

export function packFor(slug: string): Pack | null {
  const p = PACKS[slug];
  if (!p) return null;
  const mo = p.size / 1_048_576;
  const size = mo >= 1 ? `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(p.size / 1024))} Ko`;
  return { url: `${import.meta.env.BASE_URL}packs/${slug}/${encodeURIComponent(p.file)}`, file: p.file, size };
}
