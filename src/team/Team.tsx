import { ArchiveRestore, BarChart3, FilePen, FolderPlus, Inbox, Library, LogOut, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Head, SpaceIcon } from '../components/Icon.tsx';
import { friendlyError } from '../lib/api.ts';
import { ago, plural } from '../lib/format.ts';
import { slugify } from '../lib/slug.ts';
import { invalidate, useData, useOverview, useSession, useSpaces } from '../lib/store.ts';
import type { CatalogRow, Draft, PageLite, Space, StatRow } from '../lib/types.ts';
import { href, navigate } from '../router.ts';
import { setTitle } from '../views/SpaceView.tsx';
import { Field, SourcePill, toast, Toasts } from './ui.tsx';

export function usePageIndex() {
  const { api } = useSession();
  return useData<PageLite[]>('team:index', () => api.pageIndex());
}

function Login() {
  const { api, refreshMember } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="page-narrow login" id="contenu">
      <div className="login__box">
        <h1 className="page-title">Espace équipe</h1>
        <p className="muted">Connecte-toi avec ton compte Tsuki, le même que dans l’application. Les comptes se créent sur invitation dans Tsuki.</p>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api.signIn(email, password);
              await refreshMember();
            } catch (err) {
              setError(friendlyError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Adresse e-mail">
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Mot de passe">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="form__error">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          {api.mode === 'demo' && <p className="muted small">Démo : n’importe quelle adresse et n’importe quel mot de passe.</p>}
        </form>
      </div>
    </main>
  );
}

const TABS = [
  { id: '', label: 'Propositions', icon: <Inbox size={16} /> },
  { id: 'espaces', label: 'Espaces', icon: <Library size={16} /> },
  { id: 'stats', label: 'Statistiques', icon: <BarChart3 size={16} /> },
  { id: 'corbeille', label: 'Corbeille', icon: <Trash2 size={16} /> },
  { id: 'nouvel-espace', label: 'Nouvel espace', icon: <FolderPlus size={16} /> },
];

export default function Team({ tab }: { tab: string }) {
  const { member, api } = useSession();
  useEffect(() => setTitle('Espace équipe'), []);
  if (!member) return <Login />;
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <main className="team" id="contenu">
      <header className="team__head">
        <div className="team__who">
          {member.mc_name && <Head name={member.mc_name} size={40} />}
          <div>
            <h1 className="page-title">Espace équipe</h1>
            <p className="muted">
              Connecté en tant que {member.pseudo}
              {member.admin ? ' · admin' : ''}
            </p>
          </div>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={async () => {
            await api.signOut();
            navigate('/');
          }}
        >
          <LogOut size={14} /> Déconnexion
        </button>
      </header>
      <nav className="team__tabs" aria-label="Rubriques">
        {TABS.map((t) => (
          <a key={t.id} href={href(`/equipe${t.id ? '/' + t.id : ''}`)} className={t.id === current.id ? 'is-on' : ''}>
            {t.icon}
            {t.label}
          </a>
        ))}
      </nav>
      {current.id === '' && <Drafts />}
      {current.id === 'espaces' && <Spaces />}
      {current.id === 'stats' && <Stats />}
      {current.id === 'corbeille' && <Trash />}
      {current.id === 'nouvel-espace' && <NewSpace />}
      <Toasts />
    </main>
  );
}

function Drafts() {
  const { api } = useSession();
  const drafts = useData<Draft[]>('team:drafts', () => api.drafts());
  const index = usePageIndex();
  const spaces = useSpaces();
  if (drafts.error) return <p className="form__error">{drafts.error}</p>;
  if (!drafts.data || !index.data || !spaces.data) return <span className="sk sk--block" />;
  const list = drafts.data
    .map((d) => {
      const page = index.data!.find((p) => p.id === d.page_id);
      const space = page && spaces.data!.find((s) => s.id === page.space_id);
      return { d, page, space };
    })
    .filter((x) => x.page && x.space && !x.page.archived);
  const claude = list.filter((x) => x.d.source !== 'site');
  const mine = list.filter((x) => x.d.source === 'site');
  const Row = ({ d, page, space }: (typeof list)[number]) => (
    <li className="row">
      <SpaceIcon icon={space!.icon} title={space!.title} color={space!.color} size={32} />
      <div className="row__main">
        <p className="row__title">
          {d.title || page!.title} <span className="muted">· {space!.title}</span>
        </p>
        <p className="row__meta">
          <SourcePill source={d.source} /> {d.author_label || 'Quelqu’un'} · {ago(d.updated_at)}
          {d.base_revision < page!.revision && <span className="warn"> · écrit sur une ancienne version</span>}
        </p>
        {d.note && <p className="row__note">{d.note}</p>}
      </div>
      <a className="btn btn--sm" href={href(`/equipe/editer/${space!.slug}/${page!.slug}`)}>
        <FilePen size={14} /> Ouvrir
      </a>
    </li>
  );
  return (
    <div className="team__panel">
      <section>
        <h2 className="team__h2">Propositions de Claude et de GitHub</h2>
        <p className="muted small">Quand Claude écrit sur une page qui a changé entre-temps, son texte arrive ici au lieu d’être publié. Ouvre-le pour comparer, corriger et publier.</p>
        {claude.length ? <ul className="rows">{claude.map((x) => <Row key={x.d.page_id} {...x} />)}</ul> : <p className="muted">Aucune proposition en attente.</p>}
      </section>
      <section>
        <h2 className="team__h2">Brouillons en cours</h2>
        {mine.length ? <ul className="rows">{mine.map((x) => <Row key={x.d.page_id} {...x} />)}</ul> : <p className="muted">Aucun brouillon. Chaque page modifiée sur le site garde son brouillon ici jusqu’à sa publication.</p>}
      </section>
    </div>
  );
}

function Spaces() {
  const spaces = useSpaces();
  const overview = useOverview();
  if (!spaces.data) return <span className="sk sk--block" />;
  const list = spaces.data.filter((s) => !s.archived);
  return (
    <div className="team__panel">
      <ul className="rows">
        {list.map((s) => {
          const o = overview.data?.find((x) => x.space_id === s.id);
          return (
            <li key={s.id} className="row">
              <SpaceIcon icon={s.icon} title={s.title} color={s.color} size={32} />
              <div className="row__main">
                <p className="row__title">
                  {s.title} {s.version_label && <span className="muted">· {s.version_label}</span>}
                </p>
                <p className="row__meta">
                  {s.published ? <span className="pill pill--ok">Publié</span> : <span className="pill">Non publié</span>}
                  {s.visibility === 'equipe' && <span className="pill pill--team">Équipe</span>}
                  {o ? ` ${plural(o.pages, 'page')} · ${plural(o.roles, 'rôle')}` : ' Aucune page publiée'}
                  {s.kind === 'guide' && ' · guide'}
                </p>
              </div>
              <a className="btn btn--ghost btn--sm" href={href(`/${s.slug}`)}>
                Voir
              </a>
              <a className="btn btn--sm" href={href(`/equipe/espace/${s.slug}`)}>
                Fiche et plan
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stats() {
  const { api } = useSession();
  const [days, setDays] = useState(30);
  const stats = useData<StatRow[]>(`team:stats:${days}`, () => api.stats(days));
  const index = usePageIndex();
  const spaces = useSpaces();
  const rows = useMemo(() => {
    const by = new Map<string, { views: number; up: number; down: number }>();
    for (const r of stats.data ?? []) {
      const o = by.get(r.page_id) ?? { views: 0, up: 0, down: 0 };
      o.views += r.views;
      o.up += r.up;
      o.down += r.down;
      by.set(r.page_id, o);
    }
    return [...by]
      .map(([id, v]) => {
        const page = index.data?.find((p) => p.id === id);
        return { id, ...v, page, space: page && spaces.data?.find((s) => s.id === page.space_id) };
      })
      .filter((r) => r.page && r.space)
      .sort((a, b) => b.views - a.views);
  }, [stats.data, index.data, spaces.data]);
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stats.data ?? []) m.set(r.day, (m.get(r.day) ?? 0) + r.views);
    const out: { day: string; views: number }[] = [];
    for (let d = days - 1; d >= 0; d--) {
      const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
      out.push({ day, views: m.get(day) ?? 0 });
    }
    return out;
  }, [stats.data, days]);
  if (stats.error) return <p className="form__error">{stats.error}</p>;
  const total = rows.reduce((n, r) => n + r.views, 0);
  const max = Math.max(1, ...rows.map((r) => r.views));
  const maxDay = Math.max(1, ...perDay.map((d) => d.views));
  const worst = rows.filter((r) => r.down > r.up && r.down > 0);
  return (
    <div className="team__panel">
      <div className="chips">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`chip ${days === d ? 'is-on' : ''}`} onClick={() => setDays(d)}>
            {d} jours
          </button>
        ))}
      </div>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi__value">{total}</span>
          <span className="kpi__label">pages lues</span>
        </div>
        <div className="kpi">
          <span className="kpi__value">{rows.reduce((n, r) => n + r.up, 0)}</span>
          <span className="kpi__label">« ça m’a aidé »</span>
        </div>
        <div className="kpi">
          <span className="kpi__value">{rows.reduce((n, r) => n + r.down, 0)}</span>
          <span className="kpi__label">« pas vraiment »</span>
        </div>
      </div>
      <div className="daybars" role="img" aria-label="Lectures par jour">
        {perDay.map((d) => (
          <span key={d.day} style={{ height: `${(d.views / maxDay) * 100}%` }} title={`${d.day} : ${d.views}`} />
        ))}
      </div>
      {worst.length > 0 && (
        <p className="warnbox">
          À revoir : {worst.slice(0, 5).map((r) => `${r.space!.title} › ${r.page!.title}`).join(', ')} (plus de « pas vraiment » que de « oui »).
        </p>
      )}
      <h2 className="team__h2">Pages les plus lues</h2>
      <ul className="statlist">
        {rows.slice(0, 30).map((r) => (
          <li key={r.id}>
            <a href={href(`/${r.space!.slug}/${r.page!.slug}`)}>
              {r.space!.title} › {r.page!.title}
            </a>
            <span className="statlist__bar">
              <span style={{ width: `${(r.views / max) * 100}%` }} />
            </span>
            <span className="statlist__n">{r.views}</span>
            <span className="statlist__votes muted">
              👍 {r.up} · 👎 {r.down}
            </span>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Pas encore de lectures sur cette période.</p>}
    </div>
  );
}

function Trash() {
  const { api, member } = useSession();
  const index = usePageIndex();
  const spaces = useSpaces();
  if (!index.data || !spaces.data) return <span className="sk sk--block" />;
  const pages = index.data.filter((p) => p.archived && !index.data!.find((x) => x.id === p.parent_id)?.archived);
  const archivedSpaces = spaces.data.filter((s) => s.archived);
  const restorePage = async (p: PageLite) => {
    try {
      await api.updatePage(p.id, { archived: false });
      invalidate('pages:', 'team:', 'overview');
      toast(`« ${p.title} » est revenue.`);
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
  };
  const restoreSpace = async (s: Space) => {
    try {
      await api.updateSpace(s.id, { archived: false });
      invalidate();
      toast(`« ${s.title} » est revenu.`);
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
  };
  return (
    <div className="team__panel">
      <p className="muted small">Rien n’est jamais effacé : une page mise à la corbeille garde tout son historique et revient d’un clic.</p>
      <h2 className="team__h2">Pages</h2>
      {pages.length ? (
        <ul className="rows">
          {pages.map((p) => {
            const s = spaces.data!.find((x) => x.id === p.space_id);
            return (
              <li key={p.id} className="row">
                <div className="row__main">
                  <p className="row__title">
                    {p.title} <span className="muted">· {s?.title}</span>
                  </p>
                  <p className="row__meta">mise à la corbeille {ago(p.updated_at)}</p>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => restorePage(p)}>
                  <ArchiveRestore size={14} /> Restaurer
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">La corbeille est vide.</p>
      )}
      {archivedSpaces.length > 0 && (
        <>
          <h2 className="team__h2">Espaces</h2>
          <ul className="rows">
            {archivedSpaces.map((s) => (
              <li key={s.id} className="row">
                <SpaceIcon icon={s.icon} title={s.title} color={s.color} size={28} />
                <div className="row__main">
                  <p className="row__title">{s.title}</p>
                </div>
                <button className="btn btn--ghost btn--sm" disabled={!member?.admin} title={member?.admin ? '' : 'Réservé aux admins'} onClick={() => restoreSpace(s)}>
                  <ArchiveRestore size={14} /> Restaurer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NewSpace() {
  const { api } = useSession();
  const spaces = useSpaces();
  const catalog = useData<CatalogRow[]>('team:catalog', () => api.catalog());
  const [form, setForm] = useState({ title: '', slug: '', kind: 'mode' as 'mode' | 'guide', version_label: '', family: '', mc_version: '1.8.9', credits: '', catalog_key: '', mode_id: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set((spaces.data ?? []).map((s) => s.catalog_key).filter(Boolean));
  const free = (catalog.data ?? []).filter((c) => !taken.has(c.seed_key));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const pick = (key: string) => {
    const c = catalog.data?.find((x) => x.seed_key === key);
    if (!c) return set({ catalog_key: '' });
    const slug = slugify(c.name.replace(/\s+UHC$/i, ''));
    set({ catalog_key: c.seed_key, title: c.name, slug, family: slug, version_label: c.version, mc_version: c.mc_version || '1.8.9', credits: c.creator ? `Mode de ${c.creator}` : '', mode_id: c.mode_id ?? '' });
    setSlugTouched(false);
  };
  return (
    <div className="team__panel">
      <form
        className="form form--grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const slug = slugify(form.slug || form.title);
            const id = await api.createSpace({
              title: form.title.trim(), slug, kind: form.kind, version_label: form.version_label.trim(), family: (form.family || slug).trim(),
              mc_version: form.mc_version.trim(), credits: form.credits.trim(), catalog_key: form.catalog_key || null, mode_id: form.mode_id || null,
            });
            await api.createPage(id, null, form.kind === 'mode' ? 'Présentation' : 'Introduction');
            invalidate();
            toast('Espace créé. Complète sa fiche, puis écris sa première page.');
            navigate(`/equipe/espace/${slug}`);
          } catch (err) {
            setError(friendlyError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Depuis le tableau des modes de Tsuki" hint="Les modes qui ont déjà leur espace ne sont pas proposés." wide>
          <select className="input" value={form.catalog_key} onChange={(e) => pick(e.target.value)}>
            <option value="">Aucun (espace libre ou guide)</option>
            {free.map((c) => (
              <option key={c.seed_key} value={c.seed_key}>
                {c.name} {c.version && `(${c.version})`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titre">
          <input className="input" value={form.title} onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value.replace(/\s+UHC$/i, '')) }) })} required />
        </Field>
        <Field label="Adresse" hint={`Le site sera à …/${slugify(form.slug || form.title) || 'adresse'}`}>
          <input className="input" value={form.slug} onChange={(e) => (setSlugTouched(true), set({ slug: e.target.value }))} />
        </Field>
        <Field label="Type">
          <select className="input" value={form.kind} onChange={(e) => set({ kind: e.target.value as 'mode' | 'guide' })}>
            <option value="mode">Mode de jeu</option>
            <option value="guide">Guide</option>
          </select>
        </Field>
        <Field label="Version affichée" hint="Ex. V2, Saison 1">
          <input className="input" value={form.version_label} onChange={(e) => set({ version_label: e.target.value })} />
        </Field>
        <Field label="Famille" hint="Même famille = versions d’un même mode, avec un sélecteur de version.">
          <input className="input" value={form.family} onChange={(e) => set({ family: e.target.value })} placeholder={slugify(form.slug || form.title)} />
        </Field>
        <Field label="Version de Minecraft">
          <input className="input" value={form.mc_version} onChange={(e) => set({ mc_version: e.target.value })} />
        </Field>
        <Field label="Crédits" wide>
          <input className="input" value={form.credits} onChange={(e) => set({ credits: e.target.value })} placeholder="Mode de …, doc de …" />
        </Field>
        {error && <p className="form__error form__field--wide">{error}</p>}
        <div className="form__actions form__field--wide">
          <button className="btn" disabled={busy || !form.title.trim()}>
            {busy ? 'Création…' : 'Créer l’espace'}
          </button>
          <span className="muted small">Il reste invisible du public tant qu’un admin ne l’a pas publié.</span>
        </div>
      </form>
    </div>
  );
}
