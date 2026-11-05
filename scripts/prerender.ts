// Après « vite build » : une page HTML par page de l'Almanach (aperçus Discord, moteurs de recherche,
// lecture sans JavaScript), le plan du site, llms.txt et une version Markdown de chaque page.
//   node scripts/prerender.ts            (lit la base avec la clé publique)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { headUrl, plainText, renderMarkdown, type RoleRef } from '../src/lib/markdown.ts';
import { buildTree, readingOrder } from '../src/lib/tree.ts';
import { STATUS_LABEL, type Page, type Space } from '../src/lib/types.ts';
import { snapshot } from './lib/rest.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = (process.env.ALMANACH_BASE ?? '/TsukiAlmanach/').replace(/\/$/, '');
const SITE = (process.env.ALMANACH_SITE ?? 'https://ora-kun.github.io/TsukiAlmanach').replace(/\/$/, '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

type Meta = { title: string; description: string; path: string; image?: string; color?: string; type?: string; md?: string };

function page(meta: Meta, body: string): string {
  const url = SITE + meta.path;
  const head = [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${meta.type ?? 'website'}">`,
    `<meta property="og:site_name" content="Almanach · Tsuki">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    meta.image ? `<meta property="og:image" content="${esc(meta.image)}">` : '',
    `<meta name="twitter:card" content="summary">`,
    meta.md ? `<link rel="alternate" type="text/markdown" href="${esc(SITE + meta.md)}">` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title === 'Almanach' ? 'Almanach · Les règles des modes UHC de Tsuki' : meta.title + ' · Almanach')}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(meta.description)}" />`)
    .replace(/<meta name="theme-color" content="[^"]*"\s*\/?>/, `<meta name="theme-color" content="${esc(meta.color ?? '#060914')}" />`)
    .replace('<!--almanach:head-->', head)
    .replace('<!--almanach:body-->', `<div class="static">${body}</div>`);
}

function write(path: string, content: string) {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function imageOf(space: Space): string | undefined {
  if (space.cover_url) return space.cover_url;
  const icon = space.icon.trim();
  if (/^https:\/\//.test(icon)) return icon;
  if (/^[A-Za-z0-9_]{2,16}$/.test(icon)) return headUrl(icon, 256);
  return undefined;
}

const snap = await snapshot();
const pagesBySpace = new Map<string, Page[]>();
for (const p of snap.pages) {
  if (!pagesBySpace.has(p.space_id)) pagesBySpace.set(p.space_id, []);
  pagesBySpace.get(p.space_id)!.push(p);
}

const sitemap: string[] = [`${SITE}/`, `${SITE}/nouveautes`];
const llms: string[] = [
  '# Almanach de Tsuki',
  '',
  '> Le livre des règles des modes UHC (Minecraft) de l’équipe Tsuki : modes, camps, rôles et nouveautés. Chaque page existe aussi en Markdown (lien .md).',
  '',
];
const full: string[] = [];
let count = 0;

const modes = snap.spaces.filter((s) => s.kind === 'mode');
const guides = snap.spaces.filter((s) => s.kind === 'guide');

for (const [label, list] of [['Modes', modes], ['Guides', guides]] as const) {
  if (!list.length) continue;
  llms.push(`## ${label}`, '');
  for (const space of list) {
    const tree = buildTree(pagesBySpace.get(space.id) ?? []);
    const order = readingOrder(tree);
    const landing = order[0];
    const status = snap.status.find((s) => s.space_id === space.id)?.status;
    const roles: RoleRef[] = order.flatMap((p) => p.roles.map((r) => ({ ...r, page: p.id === landing?.id ? '' : p.slug, pageTitle: p.title })));
    const nav = `<nav class="static__nav"><p><strong>${esc(space.title)}</strong></p><ul>${order
      .map((p) => `<li><a href="${BASE}/${space.slug}${p.id === landing?.id ? '' : '/' + p.slug}">${esc(p.title)}</a></li>`)
      .join('')}${roles.length ? `<li><a href="${BASE}/${space.slug}/_roles">Tous les rôles (${roles.length})</a></li>` : ''}</ul></nav>`;
    llms.push(`- [${space.title}${space.version_label ? ' ' + space.version_label : ''}](${SITE}/${space.slug}/${landing ? landing.slug + '.md' : ''})${space.tagline ? ' : ' + space.tagline : ''}`);

    for (const p of order) {
      const isLanding = p.id === landing?.id;
      const path = isLanding ? `/${space.slug}/` : `/${space.slug}/${p.slug}/`;
      const r = renderMarkdown(p.content, { base: BASE, space: space.slug, camps: space.camps, roles });
      const facts = isLanding
        ? `<p class="static__facts">${[status && (STATUS_LABEL[status] ?? status), space.players && `${space.players} joueurs`, space.mc_version && `Minecraft ${space.mc_version}`, space.command, space.credits]
            .filter(Boolean)
            .map((f) => esc(String(f)))
            .join(' · ')}</p>`
        : '';
      const desc = (isLanding ? space.tagline : p.description) || plainText(p.content, 180) || space.tagline || `Les règles de ${space.title}`;
      const html = `<nav class="crumbs"><a href="${BASE}/">Almanach</a><span class="crumbs__sep">/</span><a href="${BASE}/${space.slug}">${esc(space.title)}</a></nav>
<h1 class="article__title">${esc(isLanding ? space.title : p.title)}</h1>${desc ? `<p class="article__lead">${esc(desc)}</p>` : ''}${facts}
<div class="prose">${r.html}</div>${nav}`;
      write(`${path}index.html`, page({ title: isLanding ? space.title : `${p.title} · ${space.title}`, description: desc, path, image: imageOf(space), color: space.color, type: 'article', md: `/${space.slug}/${p.slug}.md` }, html));
      const md = `# ${p.title}${isLanding ? ` (${space.title})` : ''}\n\n${p.description ? `> ${p.description}\n\n` : ''}${p.content.trim()}\n`;
      write(`${space.slug}/${p.slug}.md`, md);
      full.push(`\n\n---\n\n# ${space.title} › ${p.title}\n\nAdresse : ${SITE}${path}\n\n${p.content.trim()}`);
      sitemap.push(SITE + path);
      if (!isLanding) llms.push(`  - [${p.title}](${SITE}/${space.slug}/${p.slug}.md)${p.description ? ' : ' + p.description : ''}`);
      count++;
    }

    if (roles.length) {
      const list = roles
        .map((r) => `<li><a href="${BASE}/${space.slug}${r.page ? '/' + r.page : ''}#${r.anchor}">${esc(r.name)}</a>${r.camp ? ` · ${esc(r.camp)}` : ''}${r.summary ? ` : ${esc(r.summary)}` : ''}</li>`)
        .join('');
      write(
        `${space.slug}/_roles/index.html`,
        page(
          { title: `Rôles · ${space.title}`, description: `Les ${roles.length} rôles de ${space.title}, camp par camp.`, path: `/${space.slug}/_roles/`, image: imageOf(space), color: space.color },
          `<h1 class="article__title">Tous les rôles de ${esc(space.title)}</h1><ul>${list}</ul>${nav}`,
        ),
      );
      sitemap.push(`${SITE}/${space.slug}/_roles/`);
    }
  }
  llms.push('');
}

// Accueil, nouveautés, page introuvable.
const homeList = `<ul>${snap.spaces.map((s) => `<li><a href="${BASE}/${s.slug}">${esc(s.title)}</a>${s.tagline ? ' : ' + esc(s.tagline) : ''}</li>`).join('')}</ul>`;
write(
  'index.html',
  page(
    { title: 'Almanach', description: `Les règles des ${modes.length} modes UHC de Tsuki : déroulement, camps, rôles et nouveautés.`, path: '/' },
    `<h1 class="article__title">L’Almanach</h1><p class="article__lead">Toutes les règles des modes UHC de Tsuki.</p>${homeList}`,
  ),
);
write('nouveautes/index.html', page({ title: 'Nouveautés', description: 'Ce qui a changé dans les règles des modes UHC de Tsuki.', path: '/nouveautes/' }, '<h1 class="article__title">Nouveautés</h1>'));
write('404.html', template.replace('<!--almanach:head-->', '').replace('<!--almanach:body-->', ''));
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
write('llms.txt', llms.join('\n') + '\n');
write('llms-full.txt', `# Almanach de Tsuki : toutes les pages\n${full.join('')}\n`);
write('version.json', JSON.stringify({ last_change: snap.lastChange, built_at: new Date().toISOString(), pages: count }) + '\n');
console.log(`Pré-rendu : ${count} pages, ${snap.spaces.length} espaces.`);
