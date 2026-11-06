// Dossier contenu/ du dépôt : un sous-dossier par espace, un fichier Markdown par page.
//
//   contenu/<espace>/_espace.md     fiche de l'espace (en-tête seulement)
//   contenu/<espace>/<page>.md      une page : en-tête + texte
//
// En-tête d'une page : title, icon, description, parent (adresse de la page parente), position,
// revision (version en ligne sur laquelle le texte a été écrit), note (ce qui change, pour les Nouveautés),
// et au besoin kind (group, link), link_url, hidden, archived, proposal (toujours proposer, ne jamais publier).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, stringifyFrontmatter, type Front, type FrontValue } from '../../src/lib/frontmatter.ts';
import type { Page, Space } from '../../src/lib/types.ts';

export const ROOT = new URL('../../contenu/', import.meta.url).pathname;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SPACE_KEYS = ['title', 'tagline', 'kind', 'icon', 'color', 'cover_url', 'family', 'version_label', 'universe', 'credits', 'origin_url', 'mc_version', 'command', 'players', 'camps', 'catalog_key', 'mode_id', 'position'] as const;

const TEXT_KEYS = ['title', 'tagline', 'icon', 'description', 'family', 'version_label', 'universe', 'credits', 'mc_version', 'command', 'players', 'mode_id', 'catalog_key', 'note'];

export type PagePayload = Record<string, FrontValue> & { slug: string };
export type SpacePayload = { slug: string; meta?: Front; pages: PagePayload[] };

// Lit les fichiers demandés (chemins relatifs à la racine du dépôt, ou tout le dossier).
export function readContenu(only?: string[]): SpacePayload[] {
  const spaces = new Map<string, SpacePayload>();
  const want = only?.map((f) => f.replace(/^contenu\//, ''));
  const files: string[] = [];
  if (want) files.push(...want.filter((f) => f.endsWith('.md') && existsSync(join(ROOT, f))));
  else if (existsSync(ROOT))
    for (const dir of readdirSync(ROOT)) {
      if (!statSync(join(ROOT, dir)).isDirectory()) continue;
      for (const f of readdirSync(join(ROOT, dir))) if (f.endsWith('.md')) files.push(`${dir}/${f}`);
    }
  for (const rel of files) {
    const [space, file, extra] = rel.split('/');
    if (extra || !file || !SLUG.test(space)) continue;
    const slug = file.replace(/\.md$/, '');
    if (!spaces.has(space)) spaces.set(space, { slug: space, pages: [] });
    const entry = spaces.get(space)!;
    const { data, body, raw } = parseFrontmatter(readFileSync(join(ROOT, rel), 'utf8'));
    // « mc_version: 1.20 » reste du texte (et non le nombre 1.2).
    for (const k of TEXT_KEYS) if (typeof data[k] === 'number') data[k] = raw[k];
    if (slug === '_espace') {
      const meta: Front = {};
      for (const k of SPACE_KEYS) if (k in data) meta[k] = data[k];
      // « published: false » garde un nouvel espace hors ligne (jamais réécrit par le miroir).
      if (typeof data.published === 'boolean') meta.published = data.published;
      entry.meta = meta;
      continue;
    }
    if (!SLUG.test(slug)) continue;
    const pg: PagePayload = { slug };
    for (const k of ['title', 'icon', 'description', 'parent', 'position', 'revision', 'note', 'kind', 'link_url', 'hidden', 'archived', 'proposal']) if (k in data) pg[k] = data[k];
    if ((data.kind ?? 'page') === 'page') pg.content = body.replace(/\s+$/, '');
    entry.pages.push(pg);
  }
  return [...spaces.values()];
}

// Écrit l'état de la base dans contenu/ (miroir) : seulement ce qui est plus récent que les fichiers.
export function writeMirror(spaces: Space[], pages: Page[]): string[] {
  const changed: string[] = [];
  const put = (rel: string, text: string) => {
    const file = join(ROOT, rel);
    if (existsSync(file) && readFileSync(file, 'utf8') === text) return;
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
    changed.push(`contenu/${rel}`);
  };
  for (const s of spaces) {
    const metaFile = join(ROOT, s.slug, '_espace.md');
    const old = existsSync(metaFile) ? parseFrontmatter(readFileSync(metaFile, 'utf8')).data : null;
    if (!old || String(old.updated_at ?? '') < s.updated_at) {
      const meta: Front = {};
      for (const k of SPACE_KEYS) {
        const v = s[k as keyof Space] as FrontValue | undefined;
        if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) meta[k] = v;
      }
      meta.updated_at = s.updated_at;
      put(`${s.slug}/_espace.md`, stringifyFrontmatter(meta, 'Fiche de l’espace. Le texte sous l’en-tête n’est pas publié.'));
    }
    const mine = pages.filter((p) => p.space_id === s.id && !p.archived && p.visibility === 'public');
    const bySlug = new Map(pages.map((p) => [p.id, p.slug]));
    for (const p of mine) {
      if (p.kind === 'page' && !p.revision) continue;
      const file = join(ROOT, s.slug, `${p.slug}.md`);
      if (existsSync(file)) {
        // Un fichier écrit sur une version plus récente ou égale (envoi en cours) n'est jamais écrasé.
        const rev = parseFrontmatter(readFileSync(file, 'utf8')).data.revision;
        if (p.kind === 'page' && typeof rev === 'number' && rev >= p.revision) continue;
      }
      const data: Front = { title: p.title };
      if (p.icon) data.icon = p.icon;
      if (p.description) data.description = p.description;
      if (p.kind !== 'page') data.kind = p.kind;
      if (p.link_url) data.link_url = p.link_url;
      if (p.parent_id && bySlug.get(p.parent_id)) data.parent = bySlug.get(p.parent_id)!;
      data.position = p.position;
      if (p.hidden) data.hidden = true;
      if (p.kind === 'page') data.revision = p.revision;
      put(`${s.slug}/${p.slug}.md`, stringifyFrontmatter(data, p.kind === 'page' ? p.content : ''));
    }
  }
  return changed;
}
