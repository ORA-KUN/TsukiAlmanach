// Fiche d'un espace (infos du mode, camps, version) et plan de ses pages.
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, FilePen, FilePlus, FolderPlus, Link2, Lock, LockOpen, Plus, Trash2, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SpaceIcon } from '../components/Icon.tsx';
import { friendlyError } from '../lib/api.ts';
import type { Camp } from '../lib/markdown.ts';
import { slugify } from '../lib/slug.ts';
import { invalidate, useData, usePages, useSession, useSpaces } from '../lib/store.ts';
import { buildTree, type TreeNode } from '../lib/tree.ts';
import type { CatalogRow, Page, Space } from '../lib/types.ts';
import { href, navigate } from '../router.ts';
import { setTitle } from '../views/SpaceView.tsx';
import { Field, Modal, toast, Toasts } from './ui.tsx';

export default function SpaceSettings({ slug, hash }: { slug: string; hash: string }) {
  const { member } = useSession();
  const spaces = useSpaces();
  const space = spaces.data?.find((s) => s.slug === slug);
  useEffect(() => {
    if (space) setTitle('Fiche et plan', space.title);
  }, [space]);
  useEffect(() => {
    if (hash && space) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 60);
  }, [hash, space]);
  if (!member) {
    return (
      <main className="main main--center">
        <a className="btn" href={href('/equipe')}>Se connecter</a>
      </main>
    );
  }
  if (spaces.error) return <main className="main main--center"><p className="form__error">{spaces.error}</p></main>;
  if (!spaces.data) return <main className="main main--center"><span className="spinner" /></main>;
  if (!space) return <main className="main main--center"><p>Espace introuvable.</p></main>;
  return (
    <main className="team" id="contenu">
      <header className="team__head">
        <div className="team__who">
          <SpaceIcon icon={space.icon} title={space.title} color={space.color} size={44} />
          <div>
            <p className="muted small">
              <a className="link" href={href('/equipe/espaces')}>
                <ArrowLeft size={13} /> Espaces
              </a>
            </p>
            <h1 className="page-title">{space.title}</h1>
          </div>
        </div>
        <a className="btn btn--ghost btn--sm" href={href(`/${space.slug}`)}>
          Voir l’espace
        </a>
      </header>
      <Plan space={space} />
      <SpaceForm key={space.id + space.updated_at} space={space} />
      <Publication space={space} />
      <Toasts />
    </main>
  );
}

// ───────────── Plan des pages ─────────────

function Plan({ space }: { space: Space }) {
  const { api } = useSession();
  const pages = usePages(space.id);
  const [adding, setAdding] = useState<null | Page['kind']>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const tree = useMemo(() => buildTree(pages.data ?? [], { hidden: true, unpublished: true }), [pages.data]);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      invalidate('pages:', 'overview', 'team:');
      if (msg) toast(msg);
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
  };

  const siblingsOf = (n: TreeNode): TreeNode[] => {
    const find = (ns: TreeNode[]): TreeNode[] | null => {
      if (ns.some((x) => x.id === n.id)) return ns;
      for (const x of ns) {
        const f = find(x.children);
        if (f) return f;
      }
      return null;
    };
    return find(tree) ?? [];
  };
  const parentOf = (n: TreeNode) => (pages.data ?? []).find((p) => p.id === n.parent_id) ?? null;

  const move = (n: TreeNode, dir: -1 | 1) => {
    const sib = siblingsOf(n);
    const i = sib.findIndex((x) => x.id === n.id);
    const other = sib[i + dir];
    if (!other) return;
    // Positions recalculées pour toute la fratrie : simple et sans collision.
    const order = [...sib];
    order.splice(i, 1);
    order.splice(i + dir, 0, n);
    return run(() => Promise.all(order.map((x, k) => (x.position !== k + 1 ? api.updatePage(x.id, { position: k + 1 }) : null))));
  };
  const indent = (n: TreeNode) => {
    const sib = siblingsOf(n);
    const i = sib.findIndex((x) => x.id === n.id);
    const target = sib.slice(0, i).reverse().find((x) => x.kind !== 'link');
    if (!target) return;
    return run(() => api.updatePage(n.id, { parent_id: target.id, position: (target.children.at(-1)?.position ?? 0) + 1 }));
  };
  const outdent = (n: TreeNode) => {
    const parent = parentOf(n);
    if (!parent) return;
    return run(() => api.updatePage(n.id, { parent_id: parent.parent_id, position: parent.position + 0.5 }));
  };

  const Row = ({ n }: { n: TreeNode }) => {
    const sib = siblingsOf(n);
    const i = sib.findIndex((x) => x.id === n.id);
    return (
      <li>
        <div className={`plan__row ${n.hidden ? 'is-hidden' : ''}`} style={{ paddingLeft: 10 + n.depth * 22 }}>
          <span className="plan__kind">{n.kind === 'group' ? <FolderPlus size={15} /> : n.kind === 'link' ? <Link2 size={15} /> : n.icon ? <SpaceIcon icon={n.icon} title={n.title} size={18} /> : <FilePen size={15} />}</span>
          {renaming === n.id ? (
            <form
              className="plan__rename"
              onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get('t') ?? '').trim();
                setRenaming(null);
                if (v && v !== n.title) void run(() => api.updatePage(n.id, { title: v }), 'Renommée.');
              }}
            >
              <input className="input" name="t" defaultValue={n.title} autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
            </form>
          ) : (
            <button className="plan__title" onClick={() => setRenaming(n.id)} title="Renommer">
              {n.title}
              {n.kind === 'page' && !n.published_at && <span className="tree__new"> · jamais publiée</span>}
              {n.kind === 'page' && <span className="plan__slug">/{n.slug}</span>}
            </button>
          )}
          <span className="plan__tools">
            <button className="iconbtn iconbtn--sm" disabled={i <= 0} onClick={() => move(n, -1)} title="Monter" aria-label="Monter">
              <ArrowUp size={14} />
            </button>
            <button className="iconbtn iconbtn--sm" disabled={i >= sib.length - 1} onClick={() => move(n, 1)} title="Descendre" aria-label="Descendre">
              <ArrowDown size={14} />
            </button>
            <button className="iconbtn iconbtn--sm" disabled={!n.parent_id} onClick={() => outdent(n)} title="Sortir du groupe" aria-label="Sortir du groupe">
              <ArrowLeft size={14} />
            </button>
            <button className="iconbtn iconbtn--sm" disabled={!sib.slice(0, i).some((x) => x.kind !== 'link')} onClick={() => indent(n)} title="Ranger sous la page du dessus" aria-label="Ranger sous la page du dessus">
              <ArrowRight size={14} />
            </button>
            <button
              className="iconbtn iconbtn--sm"
              onClick={() => run(() => api.updatePage(n.id, { visibility: n.visibility === 'public' ? 'equipe' : 'public' }), n.visibility === 'public' ? 'Réservée à l’équipe.' : 'Visible par tous.')}
              title={n.visibility === 'public' ? 'Visible par tous (cliquer pour réserver à l’équipe)' : 'Réservée à l’équipe (cliquer pour ouvrir à tous)'}
              aria-label="Visibilité"
            >
              {n.visibility === 'public' ? <LockOpen size={14} /> : <Lock size={14} className="violet" />}
            </button>
            <button className="iconbtn iconbtn--sm" onClick={() => run(() => api.updatePage(n.id, { hidden: !n.hidden }))} title={n.hidden ? 'Masquée du sommaire' : 'Affichée dans le sommaire'} aria-label="Afficher ou masquer">
              {n.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {n.kind === 'page' && (
              <a className="iconbtn iconbtn--sm" href={href(`/equipe/editer/${space.slug}/${n.slug}`)} title="Modifier le contenu" aria-label="Modifier le contenu">
                <FilePen size={14} />
              </a>
            )}
            <button className="iconbtn iconbtn--sm iconbtn--danger" onClick={() => run(() => api.updatePage(n.id, { archived: true }), `« ${n.title} » mise à la corbeille.`)} title="Mettre à la corbeille" aria-label="Mettre à la corbeille">
              <Trash2 size={14} />
            </button>
          </span>
        </div>
        {n.children.length > 0 && (
          <ul>
            {n.children.map((c) => (
              <Row key={c.id} n={c} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="team__panel" id="plan">
      <div className="team__sectionhead">
        <h2 className="team__h2">Plan des pages</h2>
        <div className="inline">
          <button className="btn btn--sm" onClick={() => setAdding('page')}>
            <FilePlus size={14} /> Page
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setAdding('group')}>
            <FolderPlus size={14} /> Groupe
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setAdding('link')}>
            <Link2 size={14} /> Lien
          </button>
        </div>
      </div>
      <p className="muted small">La première page sert d’accueil à l’espace, sous la fiche du mode. Clique sur un titre pour le renommer. Les flèches rangent les pages ; un groupe est un intertitre du sommaire.</p>
      {!pages.data ? (
        <span className="sk sk--block" />
      ) : tree.length ? (
        <ul className="plan">
          {tree.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </ul>
      ) : (
        <p className="muted">Aucune page pour l’instant.</p>
      )}
      {adding && (
        <AddModal
          kind={adding}
          groups={(pages.data ?? []).filter((p) => p.kind === 'group' && !p.archived)}
          onClose={() => setAdding(null)}
          onAdd={async (title, parent, url) => {
            try {
              const id = await api.createPage(space.id, parent, title, adding, url);
              invalidate('pages:', 'team:');
              setAdding(null);
              if (adding === 'page') {
                const fresh = await api.pages(space.id);
                const p = fresh.find((x) => x.id === id);
                if (p) navigate(`/equipe/editer/${space.slug}/${p.slug}`);
              } else toast(adding === 'group' ? 'Groupe ajouté.' : 'Lien ajouté.');
            } catch (e) {
              toast(friendlyError(e), 'err');
            }
          }}
        />
      )}
    </section>
  );
}

function AddModal({ kind, groups, onClose, onAdd }: { kind: Page['kind']; groups: Page[]; onClose: () => void; onAdd: (title: string, parent: string | null, url: string | null) => Promise<void> }) {
  const [title, setT] = useState('');
  const [parent, setParent] = useState('');
  const [url, setUrl] = useState('https://');
  const label = kind === 'page' ? 'Nouvelle page' : kind === 'group' ? 'Nouveau groupe' : 'Nouveau lien';
  return (
    <Modal
      title={label}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!title.trim() || (kind === 'link' && !/^https:\/\/.+\..+/.test(url))} onClick={() => onAdd(title.trim(), parent || null, kind === 'link' ? url.trim() : null)}>
          <Plus size={14} /> Ajouter
        </button>
      }
    >
      <div className="form">
        <Field label="Titre">
          <input className="input" value={title} onChange={(e) => setT(e.target.value)} autoFocus placeholder={kind === 'group' ? 'Ex. Annexes' : kind === 'link' ? 'Ex. Doc d’origine' : 'Ex. Rôles'} />
        </Field>
        {kind === 'link' && (
          <Field label="Adresse">
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        )}
        {kind !== 'group' && groups.length > 0 && (
          <Field label="Dans le groupe">
            <select className="input" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Aucun (à la racine)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === 'page' && <p className="muted small">La page s’ouvre dans l’éditeur. Elle n’est visible qu’une fois publiée.</p>}
      </div>
    </Modal>
  );
}

// ───────────── Fiche ─────────────

const FIELDS: { key: keyof Space; label: string; hint?: string; wide?: boolean; placeholder?: string }[] = [
  { key: 'title', label: 'Titre' },
  { key: 'slug', label: 'Adresse', hint: 'Changer l’adresse casse les liens déjà partagés.' },
  { key: 'tagline', label: 'Accroche', hint: 'Une phrase, affichée sous le titre et sur la carte du mode.', wide: true },
  { key: 'icon', label: 'Icône', hint: 'Pseudo Minecraft du personnage principal (tête du skin), emoji ou adresse d’image.' },
  { key: 'cover_url', label: 'Image de couverture', hint: 'Adresse https d’une image large (facultatif).' },
  { key: 'version_label', label: 'Version affichée', placeholder: 'V2' },
  { key: 'family', label: 'Famille', hint: 'Même famille = versions d’un même mode.' },
  { key: 'universe', label: 'Univers', placeholder: 'Naruto, Marvel…' },
  { key: 'players', label: 'Joueurs', placeholder: '12 à 40' },
  { key: 'mc_version', label: 'Version de Minecraft' },
  { key: 'command', label: 'Commande', placeholder: '/l' },
  { key: 'credits', label: 'Crédits', wide: true, placeholder: 'Mode de …, doc de …' },
  { key: 'origin_url', label: 'Doc d’origine', hint: 'Lien vers la doc du créateur (GitBook…), affiché avec les crédits.', wide: true },
  { key: 'mode_id', label: 'Identifiant du mode dans le plugin', placeholder: 'lovecraft' },
];

function SpaceForm({ space }: { space: Space }) {
  const { api } = useSession();
  const catalog = useData<CatalogRow[]>('team:catalog', () => api.catalog());
  const [form, setForm] = useState<Space>(space);
  const [busy, setBusy] = useState(false);
  const changed = (Object.keys(form) as (keyof Space)[]).filter((k) => JSON.stringify(form[k]) !== JSON.stringify(space[k]));
  const set = (patch: Partial<Space>) => setForm((f) => ({ ...f, ...patch }));
  const setCamp = (i: number, patch: Partial<Camp>) => set({ camps: form.camps.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <section className="team__panel" id="fiche">
      <div className="team__sectionhead">
        <h2 className="team__h2">Fiche du mode</h2>
      </div>
      <form
        className="form form--grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const patch: Record<string, unknown> = {};
            for (const k of changed) {
              const v = form[k];
              patch[k] = typeof v === 'string' ? (['cover_url', 'origin_url', 'catalog_key', 'mode_id'].includes(k) ? v.trim() || null : v.trim()) : v;
            }
            if (patch.slug !== undefined) patch.slug = slugify(String(patch.slug));
            if (patch.camps) patch.camps = form.camps.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), color: c.color }));
            await api.updateSpace(space.id, patch);
            invalidate();
            toast('Fiche enregistrée.');
            if (patch.slug && patch.slug !== space.slug) navigate(`/equipe/espace/${patch.slug}`, { replace: true });
          } catch (err) {
            toast(friendlyError(err), 'err');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Type">
          <select className="input" value={form.kind} onChange={(e) => set({ kind: e.target.value as Space['kind'] })}>
            <option value="mode">Mode de jeu</option>
            <option value="guide">Guide</option>
          </select>
        </Field>
        <Field label="Couleur">
          <span className="inline">
            <input type="color" className="color" value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#8cc4ff'} onChange={(e) => set({ color: e.target.value })} />
            <input className="input" value={form.color} onChange={(e) => set({ color: e.target.value })} />
          </span>
        </Field>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} wide={f.wide}>
            <input className="input" value={String(form[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => set({ [f.key]: e.target.value } as Partial<Space>)} />
          </Field>
        ))}
        <Field label="Ligne du tableau des modes (Tsuki)" hint="Relie l’espace à son mode : statut affiché, lien de doc rempli dans Tsuki." wide>
          <select className="input" value={form.catalog_key ?? ''} onChange={(e) => set({ catalog_key: e.target.value || null })}>
            <option value="">Aucune</option>
            {(catalog.data ?? []).map((c) => (
              <option key={c.seed_key} value={c.seed_key}>
                {c.name} {c.version && `(${c.version})`}
              </option>
            ))}
          </select>
        </Field>
        <div className="form__field form__field--wide">
          <span className="form__label">Camps</span>
          <div className="camps-edit">
            {form.camps.map((c, i) => (
              <div key={i} className="camps-edit__row">
                <input type="color" className="color" value={/^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#8cc4ff'} onChange={(e) => setCamp(i, { color: e.target.value })} aria-label="Couleur du camp" />
                <input className="input" value={c.name} onChange={(e) => setCamp(i, { name: e.target.value })} placeholder="Nom du camp" />
                <button type="button" className="iconbtn" onClick={() => set({ camps: form.camps.filter((_, k) => k !== i) })} aria-label="Retirer le camp">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ camps: [...form.camps, { name: '', color: '#b49cff' }] })}>
              <Plus size={14} /> Ajouter un camp
            </button>
          </div>
          <span className="form__hint">Le nom doit être écrit pareil dans les cartes de rôle (camp="…") pour prendre la couleur.</span>
        </div>
        <div className="form__actions form__field--wide">
          <button className="btn" disabled={busy || !changed.length}>
            {busy ? 'Enregistrement…' : 'Enregistrer la fiche'}
          </button>
          {changed.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setForm(space)}>
              Annuler
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function Publication({ space }: { space: Space }) {
  const { api, member } = useSession();
  const admin = !!member?.admin;
  const apply = async (patch: Partial<Space>, msg: string) => {
    try {
      await api.updateSpace(space.id, patch);
      invalidate();
      toast(msg);
      if (patch.archived) navigate('/equipe/espaces');
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
  };
  return (
    <section className="team__panel" id="publication">
      <div className="team__sectionhead">
        <h2 className="team__h2">Publication</h2>
      </div>
      {!admin && <p className="muted small">Publier, réserver ou archiver un espace est réservé aux admins de Tsuki.</p>}
      <div className="pubgrid">
        <div className="pubcard">
          <p className="pubcard__title">{space.published ? 'Publié' : 'Non publié'}</p>
          <p className="muted small">{space.published ? 'L’espace apparaît sur l’accueil et dans la recherche.' : 'Seule l’équipe voit l’espace. Publie-le quand sa première page est prête.'}</p>
          <button className={`btn btn--sm ${space.published ? 'btn--ghost' : ''}`} disabled={!admin} onClick={() => apply({ published: !space.published }, space.published ? 'Espace dépublié.' : 'Espace publié !')}>
            {space.published ? 'Dépublier' : 'Publier l’espace'}
          </button>
        </div>
        <div className="pubcard">
          <p className="pubcard__title">{space.visibility === 'public' ? 'Ouvert à tous' : 'Réservé à l’équipe'}</p>
          <p className="muted small">Un espace réservé reste invisible du public même publié (cahiers des charges, notes internes).</p>
          <button className="btn btn--ghost btn--sm" disabled={!admin} onClick={() => apply({ visibility: space.visibility === 'public' ? 'equipe' : 'public' }, 'Visibilité changée.')}>
            {space.visibility === 'public' ? 'Réserver à l’équipe' : 'Ouvrir à tous'}
          </button>
        </div>
        <div className="pubcard">
          <p className="pubcard__title">Archiver</p>
          <p className="muted small">L’espace part à la corbeille avec ses pages. Il revient d’un clic.</p>
          <button className="btn btn--danger btn--sm" disabled={!admin} onClick={() => apply({ archived: true }, 'Espace archivé.')}>
            <Trash2 size={14} /> Archiver
          </button>
        </div>
      </div>
    </section>
  );
}
