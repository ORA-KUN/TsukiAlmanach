// Petit routeur : adresses propres sous la base du site (/TsukiAlmanach/…), sans dépendance.
import { useEffect, useSyncExternalStore } from 'react';

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Loc = { path: string; search: URLSearchParams; hash: string };

let snapshot = read();
const listeners = new Set<() => void>();

function read() {
  let path = decodeURI(location.pathname);
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
  path = '/' + path.replace(/^\/+/, '').replace(/\/index\.html$/, '').replace(/\/+$/, '');
  return { path, searchStr: location.search, hash: decodeURIComponent(location.hash.slice(1)), key: path + location.search + location.hash };
}

function emit() {
  const next = read();
  if (next.key !== snapshot.key) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
}

window.addEventListener('popstate', emit);

export function href(to: string): string {
  return BASE + (to.startsWith('/') ? to : '/' + to);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = /^https?:/.test(to) ? to : href(to);
  if (opts.replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  emit();
  const hash = new URL(url, location.href).hash;
  if (!hash) window.scrollTo({ top: 0 });
}

export function useLocation(): Loc {
  const snap = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => snapshot,
  );
  return { path: snap.path, search: new URLSearchParams(snap.searchStr), hash: snap.hash };
}

// Les liens internes (<a href="/TsukiAlmanach/…">) passent par le routeur au lieu de recharger la page.
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !(url.pathname === BASE || url.pathname.startsWith(BASE + '/'))) return;
      e.preventDefault();
      if (url.pathname === location.pathname && url.search === location.search && url.hash) {
        history.pushState(null, '', url.href);
        emit();
        document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      navigate(url.pathname.slice(BASE.length) + url.search + url.hash);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}

export type Route =
  | { name: 'home' }
  | { name: 'changelog' }
  | { name: 'search'; q: string }
  | { name: 'team'; tab: string }
  | { name: 'edit'; space: string; page: string }
  | { name: 'space-settings'; space: string }
  | { name: 'space'; space: string; page: string | null }
  | { name: 'roles'; space: string }
  | { name: 'notfound' };

export function matchRoute(loc: Loc): Route {
  const parts = loc.path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  const [a, b, c, d] = parts;
  if (a === 'nouveautes' && !b) return { name: 'changelog' };
  if (a === 'recherche' && !b) return { name: 'search', q: loc.search.get('q') ?? '' };
  if (a === 'equipe') {
    if (b === 'editer' && c && d) return { name: 'edit', space: c, page: d };
    if (b === 'espace' && c) return { name: 'space-settings', space: c };
    return { name: 'team', tab: b ?? '' };
  }
  if (!/^[a-z0-9-]+$/.test(a) || parts.length > 2) return { name: 'notfound' };
  if (b === '_roles') return { name: 'roles', space: a };
  if (b && !/^[a-z0-9-]+$/.test(b)) return { name: 'notfound' };
  return { name: 'space', space: a, page: b ?? null };
}
