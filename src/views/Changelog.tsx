import { useEffect } from 'react';
import { keys, useData, useSession } from '../lib/store.ts';
import type { ChangelogEntry } from '../lib/types.ts';
import { ChangeList } from './Home.tsx';
import { LoadError, setTitle } from './SpaceView.tsx';

export function Changelog() {
  const { api, member } = useSession();
  const changes = useData<ChangelogEntry[]>(`${keys.changelog}:100:${member ? 'm' : 'v'}`, () => api.changelog(100));
  useEffect(() => setTitle('Nouveautés'), []);
  if (changes.error) return <LoadError message={changes.error} />;
  return (
    <main className="page-narrow" id="contenu">
      <h1 className="page-title">Nouveautés</h1>
      <p className="article__lead">Ce qui a changé dans les règles, du plus récent au plus ancien.</p>
      {!changes.data ? <span className="sk sk--block" /> : changes.data.length ? <ChangeList entries={changes.data} /> : <p className="muted">Rien pour l’instant.</p>}
    </main>
  );
}
