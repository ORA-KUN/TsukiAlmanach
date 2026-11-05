// Lecture publique de la base (clé publique, comme un visiteur) pour les scripts de build et de miroir.
import { readFileSync } from 'node:fs';
import type { Overview, Page, Space, SpaceStatus } from '../../src/lib/types.ts';

function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    const m = new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(new URL('../../.env.production', import.meta.url), 'utf8'));
    if (m) return m[1].trim();
  } catch {
    /* rien */
  }
  throw new Error(`Variable ${name} absente`);
}

export const SUPABASE_URL = env('VITE_SUPABASE_URL').replace(/\/$/, '');
const KEY = env('VITE_SUPABASE_KEY');
export const PUBLIC_KEY = KEY;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} : ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const PAGE_COLUMNS =
  'id,space_id,parent_id,slug,title,icon,kind,link_url,description,content,roles,visibility,hidden,archived,position,revision,published_at,updated_at';

export type Snapshot = { spaces: Space[]; pages: Page[]; status: SpaceStatus[]; overview: Overview[]; lastChange: string | null };

// Tout ce qu'un visiteur peut lire (espaces publiés et publics, pages publiques).
export async function snapshot(): Promise<Snapshot> {
  if (process.env.ALMANACH_DEMO === '1') return demoSnapshot();
  const [spaces, pages, status, overview, lastChange] = await Promise.all([
    call<Space[]>('docs_spaces?select=*&order=position,title'),
    call<Page[]>(`docs_pages?select=${PAGE_COLUMNS}&order=position&limit=10000`),
    call<SpaceStatus[]>('rpc/docs_space_status', { method: 'POST', body: '{}' }),
    call<Overview[]>('rpc/docs_overview', { method: 'POST', body: '{}' }),
    call<string | null>('rpc/docs_last_change', { method: 'POST', body: '{}' }),
  ]);
  return { spaces: spaces.filter((s) => s.published && !s.archived && s.visibility === 'public'), pages, status, overview, lastChange };
}

// Données de démonstration (tests, sans Internet).
async function demoSnapshot(): Promise<Snapshot> {
  const { MemoryApi } = await import('../../src/lib/demo.ts');
  const api = new MemoryApi();
  const spaces = await api.spaces();
  const pages = (await Promise.all(spaces.map((s) => api.pages(s.id)))).flat();
  return { spaces: spaces.filter((s) => s.published), pages, status: await api.status(), overview: await api.overview(), lastChange: new Date().toISOString() };
}
