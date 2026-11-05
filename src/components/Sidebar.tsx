import { ChevronDown, ChevronRight, ExternalLink, EyeOff, Lock, Plus, Settings2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TreeNode } from '../lib/tree.ts';
import type { Space } from '../lib/types.ts';
import { href, navigate } from '../router.ts';
import { SpaceIcon } from './Icon.tsx';

function contains(n: TreeNode, id: string | null): boolean {
  return !!id && (n.id === id || n.children.some((c) => contains(c, id)));
}

function Node({ n, space, current, landing }: { n: TreeNode; space: Space; current: string | null; landing: string | null }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (contains(n, current)) setOpen(true);
  }, [current, n]);
  const flags = (
    <>
      {n.visibility === 'equipe' && <Lock size={12} className="tree__flag" aria-label="Réservé à l’équipe" />}
      {n.hidden && <EyeOff size={12} className="tree__flag" aria-label="Masquée du sommaire" />}
      {!n.published_at && n.kind === 'page' && <span className="tree__new">jamais publiée</span>}
    </>
  );
  if (n.kind === 'group') {
    return (
      <li className="tree__group">
        <button className="tree__gtitle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{n.title}</span>
          {flags}
        </button>
        {open && n.children.length > 0 && (
          <ul>
            {n.children.map((c) => (
              <Node key={c.id} n={c} space={space} current={current} landing={landing} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  if (n.kind === 'link') {
    return (
      <li>
        <a className="tree__link" href={n.link_url ?? '#'} target="_blank" rel="noopener noreferrer">
          {n.icon && <SpaceIcon icon={n.icon} title={n.title} size={18} />}
          <span>{n.title}</span>
          <ExternalLink size={12} className="tree__ext" />
        </a>
      </li>
    );
  }
  const to = n.id === landing ? `/${space.slug}` : `/${space.slug}/${n.slug}`;
  return (
    <li>
      <a className={`tree__link ${n.id === current ? 'is-current' : ''}`} href={href(to)} aria-current={n.id === current ? 'page' : undefined}>
        {n.icon && <SpaceIcon icon={n.icon} title={n.title} size={18} />}
        <span>{n.title}</span>
        {flags}
      </a>
      {n.children.length > 0 && (
        <ul>
          {n.children.map((c) => (
            <Node key={c.id} n={c} space={space} current={current} landing={landing} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({
  space, versions, tree, current, landing, rolesCount, member, open, onClose,
}: {
  space: Space; versions: Space[]; tree: TreeNode[]; current: string | null; landing: string | null; rolesCount: number; member: boolean; open: boolean; onClose: () => void;
}) {
  return (
    <>
      <div className={`scrim ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} style={{ ['--space' as string]: space.color }}>
        <div className="sidebar__space">
          <a href={href(`/${space.slug}`)} className="sidebar__spacelink">
            <SpaceIcon icon={space.icon} title={space.title} color={space.color} size={36} />
            <span>
              <span className="sidebar__title">{space.title}</span>
              <span className="sidebar__kind">{space.kind === 'guide' ? 'Guide' : 'Mode de jeu'}</span>
            </span>
          </a>
          {versions.length > 1 && (
            <label className="versions">
              <span className="sr-only">Version</span>
              <select value={space.slug} onChange={(e) => navigate(`/${e.target.value}`)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.slug}>
                    {v.version_label || v.title}
                    {!v.published ? ' (non publiée)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          )}
        </div>
        <nav className="tree" aria-label={`Sommaire de ${space.title}`} onClick={(e) => (e.target as Element).closest('a') && onClose()}>
          <ul>
            {tree.map((n) => (
              <Node key={n.id} n={n} space={space} current={current} landing={landing} />
            ))}
          </ul>
          {rolesCount > 0 && (
            <a className={`tree__roles ${current === '_roles' ? 'is-current' : ''}`} href={href(`/${space.slug}/_roles`)}>
              <Users size={16} />
              <span>Tous les rôles</span>
              <span className="count">{rolesCount}</span>
            </a>
          )}
        </nav>
        {member && (
          <div className="sidebar__team">
            <a className="btn btn--ghost btn--sm" href={href(`/equipe/espace/${space.slug}`)}>
              <Settings2 size={14} /> Fiche et plan
            </a>
            <a className="btn btn--ghost btn--sm" href={href(`/equipe/espace/${space.slug}#plan`)}>
              <Plus size={14} /> Page
            </a>
          </div>
        )}
      </aside>
    </>
  );
}
