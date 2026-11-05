import { CornerDownLeft, FileText, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { headUrl } from '../lib/markdown.ts';
import { useSession } from '../lib/store.ts';
import type { SearchHit, Space } from '../lib/types.ts';
import { navigate } from '../router.ts';
import { SpaceIcon } from './Icon.tsx';

export function hitPath(h: SearchHit): string {
  return `/${h.space_slug}/${h.page_slug}${h.anchor ? '#' + h.anchor : ''}`;
}

// Le snippet de la base marque les mots trouvés entre « et ».
export function Snippet({ text }: { text: string | null }) {
  if (!text) return null;
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <span className="snippet">
      {parts.map((p, i) => (p.startsWith('«') && p.endsWith('»') ? <mark key={i}>{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}
    </span>
  );
}

export function SearchPalette({ open, onClose, space }: { open: boolean; onClose: () => void; space: Space | null }) {
  const { api } = useSession();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'space' | 'all'>('space');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inSpace = !!space && scope === 'space';

  useEffect(() => {
    if (open) {
      setSel(0);
      setTimeout(() => input.current?.select(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      api
        .search(term, inSpace ? space!.id : undefined)
        .then((h) => {
          setHits(h);
          setSel(0);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 160);
    return () => clearTimeout(t);
  }, [q, inSpace, open, api, space]);

  const groups = useMemo(() => {
    const roles = hits.filter((h) => h.kind === 'role');
    const pages = hits.filter((h) => h.kind === 'page');
    return [
      { title: 'Rôles', items: roles },
      { title: 'Pages', items: pages },
    ].filter((g) => g.items.length);
  }, [hits]);
  const flat = groups.flatMap((g) => g.items);

  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    onClose();
    navigate(hitPath(h));
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  let idx = -1;
  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Recherche" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette__box">
        <div className="palette__field">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={inSpace ? `Chercher dans ${space!.title}…` : 'Chercher dans tout l’Almanach…'}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, flat.length - 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
              else if (e.key === 'Enter') {
                if (flat[sel]) go(flat[sel]);
                else if (q.trim()) (onClose(), navigate(`/recherche?q=${encodeURIComponent(q.trim())}`));
              } else if (e.key === 'Tab' && space) (e.preventDefault(), setScope((s) => (s === 'space' ? 'all' : 'space')));
            }}
            aria-label="Recherche"
          />
          <button className="iconbtn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {space && (
          <div className="palette__scope">
            <button className={scope === 'space' ? 'is-on' : ''} onClick={() => setScope('space')}>
              <SpaceIcon icon={space.icon} title={space.title} color={space.color} size={16} /> {space.title}
            </button>
            <button className={scope === 'all' ? 'is-on' : ''} onClick={() => setScope('all')}>
              <Sparkles size={14} /> Tout l’Almanach
            </button>
            <span className="muted small">Tab pour changer</span>
          </div>
        )}
        <div className="palette__list" ref={listRef}>
          {q.trim().length < 2 && <p className="palette__hint">Tape au moins deux lettres. Les fautes de frappe sur les noms de rôles sont pardonnées.</p>}
          {q.trim().length >= 2 && !busy && !flat.length && <p className="palette__hint">Rien trouvé pour « {q.trim()} ».</p>}
          {groups.map((g) => (
            <div key={g.title} className="palette__group">
              <p className="palette__gtitle">{g.title}</p>
              {g.items.map((h) => {
                idx++;
                const i = idx;
                return (
                  <button key={h.kind + h.page_id + (h.anchor ?? '')} className="hit" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => go(h)}>
                    <span className="hit__icon">
                      {h.kind === 'role' ? (
                        h.icon ? <img src={headUrl(h.icon, 48)} alt="" width={28} height={28} /> : <span className="hit__letter">{h.title.slice(0, 1)}</span>
                      ) : h.icon ? (
                        <SpaceIcon icon={h.icon} title={h.title} size={28} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </span>
                    <span className="hit__text">
                      <span className="hit__title">
                        {h.title}
                        {h.camp && <span className="hit__camp"> · {h.camp}</span>}
                      </span>
                      <span className="hit__where">{h.space_title}</span>
                      {h.snippet && <Snippet text={h.snippet} />}
                    </span>
                    {i === sel && <CornerDownLeft size={16} className="hit__enter" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
