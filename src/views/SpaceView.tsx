import { ArrowLeft, ArrowRight, Lock, Pencil, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Prose } from '../components/Article.tsx';
import { Feedback } from '../components/Feedback.tsx';
import { SpaceIcon } from '../components/Icon.tsx';
import { ModeHeader } from '../components/ModeHeader.tsx';
import { Sidebar } from '../components/Sidebar.tsx';
import { Toc } from '../components/Toc.tsx';
import { ago } from '../lib/format.ts';
import { campColor, headUrl, renderMarkdown, type RoleRef } from '../lib/markdown.ts';
import { slugify } from '../lib/slug.ts';
import { useOverview, usePages, useSession, useSpaces, useStatus } from '../lib/store.ts';
import { ancestors, buildTree, readingOrder, type TreeNode } from '../lib/tree.ts';
import type { Page, Space } from '../lib/types.ts';
import { BASE, href, navigate } from '../router.ts';
import { NotFound } from './NotFound.tsx';

export function setTitle(...parts: (string | undefined)[]) {
  document.title = [...parts.filter(Boolean), 'Almanach'].join(' · ');
}

const hitsSent = new Set<string>();

export function SpaceView({ slug, pageSlug, roles, hash, menuOpen, setMenuOpen }: {
  slug: string; pageSlug: string | null; roles?: boolean; hash: string; menuOpen: boolean; setMenuOpen: (o: boolean) => void;
}) {
  const { member, api } = useSession();
  const spaces = useSpaces();
  const space = spaces.data?.find((s) => s.slug === slug);
  const pages = usePages(space?.id);
  const status = useStatus();
  const overview = useOverview();

  const tree = useMemo(() => buildTree(pages.data ?? [], member ? { hidden: true, unpublished: true } : {}), [pages.data, member]);
  const order = useMemo(() => readingOrder(tree), [tree]);
  const landing = order.find((p) => !p.hidden && p.published_at) ?? order[0] ?? null;
  const allRoles: RoleRef[] = useMemo(
    () => order.filter((p) => !p.hidden || member).flatMap((p) => p.roles.map((r) => ({ ...r, page: p.id === landing?.id ? '' : p.slug, pageTitle: p.title }))),
    [order, landing, member],
  );
  const versions = useMemo(
    () => (space?.family ? (spaces.data ?? []).filter((s) => s.family === space.family && !s.archived).sort((a, b) => a.position - b.position) : []),
    [spaces.data, space],
  );

  const page: Page | undefined = roles ? undefined : pageSlug ? pages.data?.find((p) => p.slug === pageSlug && !p.archived) : landing ?? undefined;

  // Adresse canonique : la première page vit à la racine de l'espace.
  useEffect(() => {
    if (pageSlug && landing && pageSlug === landing.slug) navigate(`/${slug}${hash ? '#' + hash : ''}`, { replace: true });
  }, [pageSlug, landing, slug, hash]);

  useEffect(() => {
    if (page && page.kind === 'page' && page.published_at && !hitsSent.has(page.id)) {
      hitsSent.add(page.id);
      api.hit(page.id).catch(() => {});
    }
  }, [page, api]);

  useEffect(() => {
    if (space) setTitle(roles ? 'Rôles' : page && page.id !== landing?.id ? page.title : undefined, space.title);
  }, [space, page, landing, roles]);

  if (spaces.error) return <LoadError message={spaces.error} />;
  if (!spaces.data) return <Skeleton />;
  if (!space) return <NotFound />;
  if (pages.error) return <LoadError message={pages.error} />;
  if (!pages.data) return <Skeleton />;

  const st = status.data?.find((s) => s.space_id === space.id)?.status;
  const ov = overview.data?.find((o) => o.space_id === space.id);
  const sidebar = (
    <Sidebar
      space={space} versions={versions} tree={tree} current={roles ? '_roles' : page?.id ?? null} landing={landing?.id ?? null}
      rolesCount={allRoles.length} member={!!member} open={menuOpen} onClose={() => setMenuOpen(false)}
    />
  );

  if (roles) {
    return (
      <div className="layout layout--wide">
        {sidebar}
        <main className="main" id="contenu">
          <RolesIndex space={space} roles={allRoles} hash={hash} />
        </main>
      </div>
    );
  }

  if (!page) {
    if (!order.length) {
      return (
        <div className="layout">
          {sidebar}
          <main className="main" id="contenu">
            <ModeHeader space={space} status={st} overview={ov} />
            <div className="empty">
              <p>Cet espace n’a pas encore de page publiée.</p>
              {member && <a className="btn" href={href(`/equipe/espace/${space.slug}#plan`)}>Ajouter une page</a>}
            </div>
          </main>
        </div>
      );
    }
    return <NotFound />;
  }

  if (page.kind === 'group') return <GroupView space={space} group={tree.length ? findNode(tree, page.id) : undefined} sidebar={sidebar} />;
  if (page.kind === 'link') {
    if (page.link_url) location.href = page.link_url;
    return null;
  }

  return <PageView space={space} page={page} pages={pages.data} order={order} landing={landing} allRoles={allRoles} st={st} ov={ov} hash={hash} sidebar={sidebar} />;
}

function findNode(ns: TreeNode[], id: string): TreeNode | undefined {
  for (const n of ns) {
    if (n.id === id) return n;
    const f = findNode(n.children, id);
    if (f) return f;
  }
  return undefined;
}

function PageView({ space, page, pages, order, landing, allRoles, st, ov, hash, sidebar }: {
  space: Space; page: Page; pages: Page[]; order: TreeNode[]; landing: TreeNode | null; allRoles: RoleRef[]; st?: string; ov?: ReturnType<typeof useOverview>['data'] extends (infer O)[] | undefined ? O : never; hash: string; sidebar: React.ReactNode;
}) {
  const { member } = useSession();
  const isLanding = page.id === landing?.id;
  const rendered = useMemo(
    () => renderMarkdown(page.content, { base: BASE, space: space.slug, camps: space.camps, roles: allRoles }),
    [page.content, space, allRoles],
  );
  const i = order.findIndex((p) => p.id === page.id);
  const prev = i > 0 ? order[i - 1] : null;
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  const crumbs = ancestors(pages, page.id);
  const pathOf = (p: Page) => (p.id === landing?.id ? `/${space.slug}` : `/${space.slug}/${p.slug}`);

  return (
    <div className="layout">
      {sidebar}
      <main className="main" id="contenu">
        <article className="article" style={{ ['--space' as string]: space.color }}>
          {isLanding ? (
            <ModeHeader space={space} status={st} overview={ov} />
          ) : (
            <header className="article__head">
              <nav className="crumbs" aria-label="Fil d’Ariane">
                <a href={href(`/${space.slug}`)}>{space.title}</a>
                {crumbs.map((c) => (
                  <span key={c.id}>
                    <span className="crumbs__sep">/</span>
                    {c.kind === 'page' ? <a href={href(pathOf(c))}>{c.title}</a> : c.title}
                  </span>
                ))}
              </nav>
              <h1 className="article__title">
                {page.icon && <SpaceIcon icon={page.icon} title={page.title} size={38} className="article__icon" />}
                {page.title}
              </h1>
              {page.description && <p className="article__lead">{page.description}</p>}
            </header>
          )}
          {(page.visibility === 'equipe' || member) && (
            <div className="article__tools">
              {page.visibility === 'equipe' && (
                <span className="pill pill--team">
                  <Lock size={12} /> Réservé à l’équipe
                </span>
              )}
              {member && (
                <a className="btn btn--ghost btn--sm" href={href(`/equipe/editer/${space.slug}/${page.slug}`)}>
                  <Pencil size={14} /> Modifier
                </a>
              )}
            </div>
          )}
          {page.published_at ? (
            <Prose html={rendered.html} hash={hash} />
          ) : (
            <div className="empty">
              <p>Cette page n’a pas encore été publiée.</p>
            </div>
          )}
          <footer className="article__foot">
            {page.published_at && <Feedback pageId={page.id} />}
            <p className="muted small">Mise à jour {ago(page.updated_at)}</p>
          </footer>
          {(prev || next) && (
            <nav className="pager" aria-label="Pages voisines">
              {prev ? (
                <a className="pager__link" href={href(pathOf(prev))}>
                  <span className="pager__dir">
                    <ArrowLeft size={14} /> Précédent
                  </span>
                  <span className="pager__title">{prev.title}</span>
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a className="pager__link pager__link--next" href={href(pathOf(next))}>
                  <span className="pager__dir">
                    Suivant <ArrowRight size={14} />
                  </span>
                  <span className="pager__title">{next.title}</span>
                </a>
              )}
            </nav>
          )}
        </article>
      </main>
      <Toc headings={rendered.headings} />
    </div>
  );
}

function GroupView({ space, group, sidebar }: { space: Space; group?: TreeNode; sidebar: React.ReactNode }) {
  if (!group) return <NotFound />;
  return (
    <div className="layout">
      {sidebar}
      <main className="main" id="contenu">
        <article className="article">
          <header className="article__head">
            <nav className="crumbs">
              <a href={href(`/${space.slug}`)}>{space.title}</a>
            </nav>
            <h1 className="article__title">{group.title}</h1>
          </header>
          <div className="cards">
            {group.children.filter((c) => c.kind !== 'group').map((c) => (
              <a key={c.id} className="card card--page" href={c.kind === 'link' ? c.link_url ?? '#' : href(`/${space.slug}/${c.slug}`)}>
                {c.icon && <SpaceIcon icon={c.icon} title={c.title} size={28} />}
                <span className="card__title">{c.title}</span>
                {c.description && <span className="card__desc">{c.description}</span>}
              </a>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}

function RolesIndex({ space, roles, hash }: { space: Space; roles: RoleRef[]; hash: string }) {
  const [q, setQ] = useState('');
  const [camp, setCamp] = useState<string | null>(null);
  useEffect(() => {
    if (hash.startsWith('camp-')) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const nq = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = roles.filter(
    (r) => (!camp || r.camp === camp) && (!nq || (r.name + ' ' + r.summary).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nq)),
  );
  const camps = [...new Set(roles.map((r) => r.camp))];
  const byCamp = new Map<string, RoleRef[]>();
  for (const r of list) {
    if (!byCamp.has(r.camp)) byCamp.set(r.camp, []);
    byCamp.get(r.camp)!.push(r);
  }
  return (
    <article className="article article--wide">
      <header className="article__head">
        <nav className="crumbs">
          <a href={href(`/${space.slug}`)}>{space.title}</a>
        </nav>
        <h1 className="article__title">Tous les rôles</h1>
        <p className="article__lead">
          {roles.length} rôles dans {camps.length} camps. Clique sur un rôle pour lire sa fiche.
        </p>
      </header>
      <div className="filters">
        <label className="field field--search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer les rôles…" />
        </label>
        <div className="chips">
          <button className={`chip ${!camp ? 'is-on' : ''}`} onClick={() => setCamp(null)}>Tous</button>
          {camps.map((c) => (
            <button key={c} className={`chip ${camp === c ? 'is-on' : ''}`} style={{ ['--camp' as string]: campColor(c, space.camps) }} onClick={() => setCamp(camp === c ? null : c)}>
              <span className="dot" /> {c || 'Sans camp'}
            </button>
          ))}
        </div>
      </div>
      {[...byCamp].map(([c, rs]) => (
        <section key={c} className="rolegrid" id={`camp-${slugify(c) || 'sans-camp'}`} style={{ ['--camp' as string]: campColor(c, space.camps) }}>
          <h2 className="rolegrid__title">
            <span className="dot" /> {c || 'Sans camp'} <span className="muted">· {rs.length}</span>
          </h2>
          <div className="rolegrid__list">
            {rs.map((r) => (
              <a key={r.page + r.anchor} className="rolecard" href={href(`/${space.slug}${r.page ? '/' + r.page : ''}#${r.anchor}`)}>
                {r.head ? <img src={headUrl(r.head, 64)} alt="" width={44} height={44} loading="lazy" /> : <span className="rolecard__letter">{r.name.slice(0, 1)}</span>}
                <span className="rolecard__text">
                  <span className="rolecard__name">{r.name}</span>
                  {r.summary && <span className="rolecard__sum">{r.summary}</span>}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
      {!list.length && <p className="muted">Aucun rôle ne correspond.</p>}
    </article>
  );
}

export function Skeleton() {
  return (
    <div className="layout">
      <aside className="sidebar sidebar--skeleton">
        <span className="sk sk--block" />
        <span className="sk" />
        <span className="sk" />
        <span className="sk" />
      </aside>
      <main className="main">
        <span className="sk sk--title" />
        <span className="sk" />
        <span className="sk" />
        <span className="sk sk--short" />
      </main>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <main className="main main--center">
      <div className="empty">
        <p className="empty__title">Impossible de charger l’Almanach</p>
        <p className="muted">{message}</p>
        <button className="btn" onClick={() => location.reload()}>Réessayer</button>
      </div>
    </main>
  );
}
