import { ArrowRight, BookOpen, EyeOff, Lock, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SpaceIcon } from '../components/Icon.tsx';
import { StatusPill } from '../components/ModeHeader.tsx';
import { ago, plural } from '../lib/format.ts';
import { keys, useData, useOverview, useSession, useSpaces, useStatus } from '../lib/store.ts';
import type { ChangelogEntry, Overview, Space } from '../lib/types.ts';
import { href } from '../router.ts';
import { LoadError, setTitle } from './SpaceView.tsx';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Les huit phases, de la nouvelle lune à la dernière : le calendrier lunaire d'un almanach.
function Phases() {
  const r = 11;
  return (
    <div className="phases" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => {
        // Croissante : l'ombre part vers la gauche ; décroissante : elle revient par la droite.
        const cx = i <= 4 ? 14 - 2 * r * (i / 4) : 14 + 2 * r * (1 - (i - 4) / 4);
        return (
          <svg key={i} viewBox="0 0 28 28" width="28" height="28" style={{ animationDelay: `${i * 90}ms` }}>
            <clipPath id={`ph-${i}`}>
              <circle cx="14" cy="14" r={r} />
            </clipPath>
            <circle cx="14" cy="14" r={r} fill="var(--moon-1)" />
            {i !== 4 && <circle cx={cx} cy="14" r={r + 0.4} fill="var(--moon-shadow)" clipPath={`url(#ph-${i})`} />}
            <circle cx="14" cy="14" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="0.8" />
          </svg>
        );
      })}
    </div>
  );
}

type Card = { space: Space; versions: Space[]; overview?: Overview; status?: string };

export function Home({ onSearch }: { onSearch: () => void }) {
  const { api, member } = useSession();
  const spaces = useSpaces();
  const overview = useOverview();
  const status = useStatus();
  const changes = useData<ChangelogEntry[]>(`${keys.changelog}:6:${member ? 'm' : 'v'}`, () => api.changelog(6));
  const [filter, setFilter] = useState<string>('tous');
  const [q, setQ] = useState('');

  useEffect(() => setTitle('Les règles des modes UHC de Tsuki'), []);

  const cards = useMemo(() => {
    const list = (spaces.data ?? []).filter((s) => !s.archived);
    const fam = new Map<string, Space[]>();
    for (const s of list) {
      const k = s.family || s.id;
      if (!fam.has(k)) fam.set(k, []);
      fam.get(k)!.push(s);
    }
    const out: Card[] = [];
    for (const vs of fam.values()) {
      vs.sort((a, b) => Number(b.published) - Number(a.published) || a.position - b.position);
      const s = vs[0];
      out.push({ space: s, versions: vs, overview: overview.data?.find((o) => o.space_id === s.id), status: status.data?.find((x) => x.space_id === s.id)?.status });
    }
    return out;
  }, [spaces.data, overview.data, status.data]);

  if (spaces.error) return <LoadError message={spaces.error} />;

  const modes = cards.filter((c) => c.space.kind === 'mode');
  const guides = cards.filter((c) => c.space.kind === 'guide');
  const nq = norm(q.trim());
  const shown = modes.filter(
    (c) =>
      (filter === 'tous' || c.status === filter || (filter === 'autres' && !c.status)) &&
      (!nq || norm(`${c.space.title} ${c.space.tagline} ${c.space.universe} ${c.space.credits}`).includes(nq)),
  );
  const totalRoles = (overview.data ?? []).reduce((n, o) => n + o.roles, 0);
  const totalPages = (overview.data ?? []).reduce((n, o) => n + o.pages, 0);
  const counts = (st: string) => modes.filter((c) => c.status === st).length;

  return (
    <main className="home" id="contenu">
      <section className="hero">
        <div className="hero__text">
          <p className="hero__eyebrow">
            <Sparkles size={14} /> Tsuki UHC
          </p>
          <h1 className="hero__title">
            L’<em>Almanach</em>
          </h1>
          <p className="hero__lead">Toutes les règles des modes UHC de Tsuki, du lancement de la partie jusqu’au dernier rôle.</p>
          <button className="hero__search" onClick={onSearch}>
            <Search size={18} />
            <span>Un mode, une règle, un rôle…</span>
            <kbd>/</kbd>
          </button>
          {spaces.data && (
            <p className="hero__stats">
              <span>
                <strong>{modes.length}</strong> modes
              </span>
              {totalRoles > 0 && (
                <span>
                  <strong>{totalRoles}</strong> rôles
                </span>
              )}
              {totalPages > 0 && (
                <span>
                  <strong>{totalPages}</strong> pages
                </span>
              )}
            </p>
          )}
        </div>
        <Phases />
      </section>

      <section className="shelf" aria-labelledby="modes-title">
        <div className="shelf__head">
          <h2 id="modes-title">Les modes</h2>
          <div className="shelf__tools">
            <div className="chips" role="group" aria-label="Filtrer par statut">
              {[
                ['tous', `Tous · ${modes.length}`],
                ['fait', `Disponibles · ${counts('fait')}`],
                ['en_cours', `En cours · ${counts('en_cours')}`],
                ['pas_fait', `À venir · ${counts('pas_fait')}`],
              ]
                .filter(([k]) => k === 'tous' || counts(k) > 0)
                .map(([k, label]) => (
                  <button key={k} className={`chip ${filter === k ? 'is-on' : ''}`} onClick={() => setFilter(k)}>
                    {label}
                  </button>
                ))}
            </div>
            <label className="field field--search field--sm">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer les modes" />
            </label>
          </div>
        </div>
        {!spaces.data ? (
          <div className="grid">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="sk sk--card" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="grid">
            {shown.map((c) => (
              <ModeCard key={c.space.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="muted">{modes.length ? 'Aucun mode ne correspond.' : 'Les premiers modes arrivent bientôt.'}</p>
        )}
      </section>

      {guides.length > 0 && (
        <section className="shelf" aria-labelledby="guides-title">
          <div className="shelf__head">
            <h2 id="guides-title">Guides</h2>
          </div>
          <div className="guides">
            {guides.map((c) => (
              <a key={c.space.id} className="guide" href={href(`/${c.space.slug}`)} style={{ ['--space' as string]: c.space.color }}>
                <SpaceIcon icon={c.space.icon} title={c.space.title} color={c.space.color} size={36} />
                <span>
                  <span className="guide__title">{c.space.title}</span>
                  {c.space.tagline && <span className="guide__desc">{c.space.tagline}</span>}
                </span>
                <ArrowRight size={16} className="guide__go" />
              </a>
            ))}
          </div>
        </section>
      )}

      {changes.data && changes.data.length > 0 && (
        <section className="shelf" aria-labelledby="news-title">
          <div className="shelf__head">
            <h2 id="news-title">Dernières nouveautés</h2>
            <a className="link" href={href('/nouveautes')}>
              Tout voir <ArrowRight size={14} />
            </a>
          </div>
          <ChangeList entries={changes.data} />
        </section>
      )}
      <footer className="sitefoot">
        <BookOpen size={14} /> L’Almanach de Tsuki · écrit par l’équipe et par Claude
      </footer>
    </main>
  );
}

function ModeCard({ c }: { c: Card }) {
  const s = c.space;
  return (
    <a className="mode" href={href(`/${s.slug}`)} style={{ ['--space' as string]: s.color }}>
      <span className="mode__band">{s.cover_url && <img src={s.cover_url} alt="" loading="lazy" />}</span>
      <SpaceIcon icon={s.icon} title={s.title} color={s.color} size={56} className="mode__icon" />
      <span className="mode__body">
        <span className="mode__title">{s.title}</span>
        <span className="mode__sub">
          {[s.version_label, s.universe].filter(Boolean).join(' · ')}
          {c.versions.length > 1 && <span className="mode__versions">{c.versions.length} versions</span>}
        </span>
        {s.tagline && <span className="mode__tagline">{s.tagline}</span>}
      </span>
      <span className="mode__foot">
        <StatusPill status={c.status} />
        {!s.published && (
          <span className="pill pill--team">
            <EyeOff size={12} /> Non publié
          </span>
        )}
        {s.visibility === 'equipe' && (
          <span className="pill pill--team">
            <Lock size={12} /> Équipe
          </span>
        )}
        {c.overview && c.overview.roles > 0 && <span className="muted">{plural(c.overview.roles, 'rôle')}</span>}
        {s.mc_version && <span className="muted">{s.mc_version}</span>}
      </span>
    </a>
  );
}

export function ChangeList({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <ol className="changes">
      {entries.map((e) => (
        <li key={e.space_slug + e.page_slug + e.revision} className="change">
          <SpaceIcon icon={e.space_icon} title={e.space_title} size={28} />
          <div className="change__text">
            <p className="change__note">{e.note}</p>
            <p className="change__where">
              <a href={href(`/${e.space_slug}/${e.page_slug}`)}>
                {e.space_title} › {e.page_title}
              </a>
              <span className="muted">
                {' '}
                · {ago(e.created_at)}
                {e.author_label && ` · ${e.author_label}`}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
