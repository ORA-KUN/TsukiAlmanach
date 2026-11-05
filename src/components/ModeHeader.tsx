import { ExternalLink, Gamepad2, Puzzle, Terminal, Users } from 'lucide-react';
import { campColor } from "../lib/markdown.ts";
import { slugify } from "../lib/slug.ts";
import { STATUS_LABEL, type Overview, type Space } from '../lib/types.ts';
import { href } from '../router.ts';
import { ago, plural } from '../lib/format.ts';
import { SpaceIcon } from './Icon.tsx';

export function StatusPill({ status }: { status: string | undefined }) {
  if (!status) return null;
  return <span className={`status status--${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

// La fiche du mode, en tête de la première page d'un espace.
export function ModeHeader({ space, status, overview }: { space: Space; status?: string; overview?: Overview }) {
  const facts: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (space.players) facts.push({ icon: <Users size={15} />, label: 'Joueurs', value: space.players });
  if (space.mc_version) facts.push({ icon: <Gamepad2 size={15} />, label: 'Minecraft', value: space.mc_version });
  if (space.command) facts.push({ icon: <Terminal size={15} />, label: 'Commande', value: space.command });
  if (space.universe) facts.push({ icon: <Puzzle size={15} />, label: 'Univers', value: space.universe });
  return (
    <header className="modehead" style={{ ['--space' as string]: space.color }}>
      {space.cover_url && <img className="modehead__cover" src={space.cover_url} alt="" />}
      <div className="modehead__top">
        <SpaceIcon icon={space.icon} title={space.title} color={space.color} size={72} className="modehead__icon" />
        <div className="modehead__titles">
          <p className="modehead__eyebrow">
            {space.kind === 'guide' ? 'Guide' : 'Mode de jeu'}
            {space.version_label && <span className="modehead__version">{space.version_label}</span>}
            <StatusPill status={status} />
          </p>
          <h1 className="modehead__title">{space.title}</h1>
          {space.tagline && <p className="modehead__tagline">{space.tagline}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="modehead__facts">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>
                {f.icon} {f.label}
              </dt>
              <dd>{f.label === 'Commande' ? <code>{f.value}</code> : f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {space.camps.length > 0 && (
        <div className="modehead__camps" aria-label="Camps">
          {space.camps.map((c) => (
            <a key={c.name} className="camp" style={{ ['--camp' as string]: campColor(c.name, space.camps) }} href={href(`/${space.slug}/_roles#camp-${slugify(c.name)}`)}>
              <span className="dot" />
              {c.name}
            </a>
          ))}
        </div>
      )}
      <p className="modehead__meta">
        {overview && overview.roles > 0 && <span>{plural(overview.roles, 'rôle')}</span>}
        {overview && <span>{plural(overview.pages, 'page')}</span>}
        {overview?.updated_at && <span>mis à jour {ago(overview.updated_at)}</span>}
        {space.credits && <span>{space.credits}</span>}
        {space.origin_url && (
          <a href={space.origin_url} target="_blank" rel="noopener noreferrer">
            Doc d’origine <ExternalLink size={12} />
          </a>
        )}
      </p>
    </header>
  );
}
