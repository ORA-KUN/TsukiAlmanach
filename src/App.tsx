import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { SearchPalette } from './components/SearchPalette.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Api } from './lib/api.ts';
import { invalidate, SessionContext, useSpaces } from './lib/store.ts';
import type { Member } from './lib/types.ts';
import { matchRoute, useLinkInterception, useLocation } from './router.ts';
import { Changelog } from './views/Changelog.tsx';
import { Home } from './views/Home.tsx';
import { NotFound } from './views/NotFound.tsx';
import { SearchView } from './views/SearchView.tsx';
import { SpaceView } from './views/SpaceView.tsx';

// L'espace équipe (connexion, éditeur…) n'est chargé que s'il sert.
const Team = lazy(() => import('./team/Team.tsx'));
const Editor = lazy(() => import('./team/Editor.tsx'));
const SpaceSettings = lazy(() => import('./team/SpaceSettings.tsx'));

function Shell() {
  const loc = useLocation();
  const route = matchRoute(loc);
  const spaces = useSpaces();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useLinkInterception();

  const spaceSlug = route.name === 'space' || route.name === 'roles' ? route.space : null;
  const space = useMemo(() => (spaceSlug ? spaces.data?.find((s) => s.slug === spaceSlug) ?? null : null), [spaceSlug, spaces.data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && route.name !== 'edit') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !typing && !route.name.startsWith('edit')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.name]);

  useEffect(() => setMenuOpen(false), [loc.path]);

  const inTeam = route.name === 'team' || route.name === 'edit' || route.name === 'space-settings';
  let view: React.ReactNode;
  switch (route.name) {
    case 'home':
      view = <Home onSearch={() => setSearchOpen(true)} />;
      break;
    case 'changelog':
      view = <Changelog />;
      break;
    case 'search':
      view = <SearchView q={route.q} />;
      break;
    case 'space':
      view = <SpaceView slug={route.space} pageSlug={route.page} hash={loc.hash} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />;
      break;
    case 'roles':
      view = <SpaceView slug={route.space} pageSlug={null} roles hash={loc.hash} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />;
      break;
    case 'team':
      view = <Team tab={route.tab} />;
      break;
    case 'edit':
      view = <Editor spaceSlug={route.space} pageSlug={route.page} />;
      break;
    case 'space-settings':
      view = <SpaceSettings slug={route.space} hash={loc.hash} />;
      break;
    default:
      view = <NotFound />;
  }

  return (
    <div className={`app ${route.name === 'edit' ? 'app--editor' : ''}`}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      {route.name !== 'edit' && <TopBar onSearch={() => setSearchOpen(true)} onMenu={() => setMenuOpen((o) => !o)} showMenu={!!spaceSlug} />}
      {inTeam ? <Suspense fallback={<div className="main main--center"><span className="spinner" /></div>}>{view}</Suspense> : view}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} space={space} />
    </div>
  );
}

export function App({ api, initialMember }: { api: Api; initialMember: Member | null }) {
  const [member, setMember] = useState<Member | null>(initialMember);
  const refreshMember = useCallback(async () => {
    const m = await api.me().catch(() => null);
    setMember((old) => {
      if ((old?.id ?? null) !== (m?.id ?? null)) invalidate();
      return m;
    });
  }, [api]);
  useEffect(() => api.onAuthChange(() => void refreshMember()), [api, refreshMember]);
  const session = useMemo(() => ({ api, member, refreshMember }), [api, member, refreshMember]);
  return (
    <SessionContext.Provider value={session}>
      <Shell />
    </SessionContext.Provider>
  );
}
