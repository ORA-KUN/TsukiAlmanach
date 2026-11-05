import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hitPath, Snippet } from '../components/SearchPalette.tsx';
import { SpaceIcon } from '../components/Icon.tsx';
import { headUrl } from '../lib/markdown.ts';
import { useSession } from '../lib/store.ts';
import type { SearchHit } from '../lib/types.ts';
import { href, navigate } from '../router.ts';
import { setTitle } from './SpaceView.tsx';

export function SearchView({ q }: { q: string }) {
  const { api } = useSession();
  const [term, setTerm] = useState(q);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => setTitle(q ? `Recherche « ${q} »` : 'Recherche'), [q]);
  useEffect(() => {
    setTerm(q);
    if (q.trim().length < 2) return setHits([]);
    setHits(null);
    api.search(q).then(setHits).catch(() => setHits([]));
  }, [q, api]);
  return (
    <main className="page-narrow" id="contenu">
      <h1 className="page-title">Recherche</h1>
      <form
        className="field field--search field--lg"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/recherche?q=${encodeURIComponent(term.trim())}`, { replace: true });
        }}
      >
        <Search size={18} />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Chercher dans l’Almanach…" autoFocus />
      </form>
      {hits === null ? (
        <span className="sk sk--block" />
      ) : hits.length ? (
        <ul className="results">
          {hits.map((h) => (
            <li key={h.kind + h.page_id + (h.anchor ?? '')}>
              <a className="result" href={href(hitPath(h))}>
                {h.kind === 'role' && h.icon ? <img src={headUrl(h.icon, 48)} alt="" width={32} height={32} /> : <SpaceIcon icon={h.icon || h.space_icon} title={h.title} size={32} />}
                <span>
                  <span className="result__title">
                    {h.title} {h.kind === 'role' && <span className="pill">Rôle{h.camp ? ` · ${h.camp}` : ''}</span>}
                  </span>
                  <span className="result__where">{h.space_title}</span>
                  <Snippet text={h.snippet} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        q && <p className="muted">Rien trouvé pour « {q} ».</p>
      )}
    </main>
  );
}
