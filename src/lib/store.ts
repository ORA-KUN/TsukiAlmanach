// Données partagées par les écrans : cache en mémoire, rechargement après une modification.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Api } from './api.ts';
import type { Member, Overview, Page, Space, SpaceStatus } from './types.ts';

const values = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const listeners = new Set<(key: string) => void>();

export function load<T>(key: string, fn: () => Promise<T>, force = false): Promise<T> {
  if (!force && values.has(key)) return Promise.resolve(values.get(key) as T);
  if (!force && pending.has(key)) return pending.get(key) as Promise<T>;
  const p = fn().then(
    (v) => {
      values.set(key, v);
      pending.delete(key);
      listeners.forEach((l) => l(key));
      return v;
    },
    (e) => {
      pending.delete(key);
      throw e;
    },
  );
  pending.set(key, p);
  return p;
}

export function peek<T>(key: string): T | undefined {
  return values.get(key) as T | undefined;
}

// Oublie les données dont la clé commence par l'un des préfixes, puis prévient les écrans.
export function invalidate(...prefixes: string[]) {
  for (const k of [...values.keys()]) if (!prefixes.length || prefixes.some((p) => k.startsWith(p))) values.delete(k);
  listeners.forEach((l) => l('*'));
}

export type Data<T> = { data: T | undefined; error: string | null; loading: boolean; reload: () => void };

export function useData<T>(key: string | null, fn: () => Promise<T>): Data<T> {
  const [, bump] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const run = useCallback(
    (force = false) => {
      if (!key) return;
      setLoadingKey(key);
      setError(null);
      load(key, fn, force)
        .then(() => bump((n) => n + 1))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingKey((k) => (k === key ? null : k)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    if (key && !values.has(key)) run();
    const l = (k: string) => {
      if (!key) return;
      if (k === key) bump((n) => n + 1);
      else if (k === '*' && !values.has(key)) run();
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [key, run]);

  const data = key ? (values.get(key) as T | undefined) : undefined;
  return { data, error, loading: !!key && data === undefined && loadingKey === key && !error, reload: () => run(true) };
}

// ───── Contexte : moteur de données et membre connecté ─────

export type Session = { api: Api; member: Member | null; refreshMember: () => Promise<void> };
export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('Session absente');
  return s;
}

// ───── Chargeurs communs ─────

export const keys = {
  spaces: 'spaces',
  overview: 'overview',
  status: 'status',
  pages: (spaceId: string) => `pages:${spaceId}`,
  changelog: 'changelog',
  drafts: 'drafts',
};

export function useSpaces() {
  const { api, member } = useSession();
  return useData<Space[]>(`${keys.spaces}:${member ? 'm' : 'v'}`, () => api.spaces());
}
export function useOverview() {
  const { api, member } = useSession();
  return useData<Overview[]>(`${keys.overview}:${member ? 'm' : 'v'}`, () => api.overview());
}
export function useStatus() {
  const { api, member } = useSession();
  return useData<SpaceStatus[]>(`${keys.status}:${member ? 'm' : 'v'}`, () => api.status());
}
export function usePages(spaceId: string | undefined) {
  const { api, member } = useSession();
  return useData<Page[]>(spaceId ? `${keys.pages(spaceId)}:${member ? 'm' : 'v'}` : null, () => api.pages(spaceId!));
}
