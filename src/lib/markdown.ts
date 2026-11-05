// Rendu des pages de l'Almanach : Markdown (CommonMark + tableaux) et blocs maison.
//
// Blocs (ouverts par « ::: », fermés par une ligne « ::: » seule ; on peut les imbriquer) :
//   :::info Titre facultatif          encadrés : info, astuce, attention, danger
//   :::role Itachi Uchiha {camp="Akatsuki" tete="Itachi"}     carte de rôle (aussi :::role[Nom]{…})
//   :::tabs  puis  :::tab Titre        onglets
//   :::details Titre                   dépliant
// Lignes spéciales (« :: ») :
//   ::video https://youtu.be/…         vidéo YouTube
//   ::roles {camp="Akatsuki"}          liste des rôles de l'espace (filtre de camp facultatif)
//
// Pas de HTML libre (html: false) : rien ne peut glisser de script dans une page.
import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { slugify, uniqueSlugger } from './slug.ts';

export type Camp = { name: string; color: string };
export type RoleRef = { name: string; camp: string; head: string; anchor: string; summary: string; page?: string; pageTitle?: string };
export type Heading = { id: string; text: string; level: number; kind?: 'role' };

export type RenderContext = {
  base?: string; // préfixe des liens internes, ex. « /TsukiAlmanach »
  space?: string; // slug de l'espace courant (liens « ./page »)
  camps?: Camp[];
  roles?: RoleRef[]; // tous les rôles de l'espace, pour « ::roles »
  editor?: boolean; // rendu pour l'éditeur (attributs data-*)
};

export type Rendered = { html: string; headings: Heading[]; roles: RoleRef[] };

export const CALLOUTS = ['info', 'astuce', 'attention', 'danger'] as const;
export type CalloutKind = (typeof CALLOUTS)[number];
const CONTAINERS = new Set<string>([...CALLOUTS, 'role', 'tabs', 'tab', 'details']);
const ALIASES: Record<string, string> = { note: 'info', tip: 'astuce', warning: 'attention', avertissement: 'attention', deplier: 'details', depliant: 'details' };

export const CALLOUT_LABEL: Record<CalloutKind, string> = { info: 'Info', astuce: 'Astuce', attention: 'Attention', danger: 'Danger' };

// ───────────── Lecture des en-têtes de blocs ─────────────

export type BlockInfo = { name: string; label: string; attrs: Record<string, string> };

export function parseInfo(name: string, rest: string): BlockInfo {
  let s = rest.trim();
  const attrs: Record<string, string> = {};
  const am = /\{([^}]*)\}\s*$/.exec(s);
  if (am) {
    s = s.slice(0, am.index).trim();
    const re = /([a-zA-Zéèêà_-]+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(am[1]))) attrs[normKey(m[1])] = m[2].trim();
  }
  const lm = /^\[(.*)\]$/.exec(s);
  if (lm) s = lm[1].trim();
  return { name, label: s, attrs };
}

function normKey(k: string): string {
  const key = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ({ name: 'nom', head: 'tete', skin: 'tete', title: 'titre', type: 'type' } as Record<string, string>)[key] ?? key;
}

export function roleName(info: BlockInfo): string {
  return (info.attrs.nom || info.label).trim();
}

// ───────────── Règles de blocs ─────────────

const OPEN_RE = /^ {0,3}(:{3,})\s*([a-zA-Zéèê_-]+)(.*)$/;
const CLOSE_RE = /^ {0,3}:{3,}\s*$/;
const LEAF_RE = /^ {0,3}::(?!:)\s*([a-zA-Z]+)\s*(.*)$/;

function lineText(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
}

function containerRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const first = lineText(state, startLine);
  const m = OPEN_RE.exec(first);
  if (!m) return false;
  let name = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = ALIASES[name] ?? name;
  if (!CONTAINERS.has(name)) return false;
  if (silent) return true;

  // Cherche la ligne fermante en comptant les blocs ouverts à l'intérieur.
  let depth = 0;
  let next = startLine;
  let closed = false;
  while (++next < endLine) {
    if (state.sCount[next] < state.blkIndent && state.src.slice(state.bMarks[next], state.eMarks[next]).trim() !== '') break;
    const t = lineText(state, next);
    const om = OPEN_RE.exec(t);
    if (om && CONTAINERS.has(ALIASES[om[2].toLowerCase()] ?? om[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      depth++;
    } else if (CLOSE_RE.test(t)) {
      if (depth === 0) {
        closed = true;
        break;
      }
      depth--;
    }
  }

  const info = parseInfo(name, m[3]);
  const oldParent = state.parentType;
  const oldLineMax = state.lineMax;
  state.parentType = 'container' as typeof state.parentType;
  state.lineMax = next;

  const open = state.push(`almanach_${name}_open`, 'div', 1);
  open.block = true;
  open.meta = info;
  open.map = [startLine, next];
  open.markup = m[1];
  state.md.block.tokenize(state, startLine + 1, next);
  const close = state.push(`almanach_${name}_close`, 'div', -1);
  close.block = true;
  close.meta = info;

  state.parentType = oldParent;
  state.lineMax = oldLineMax;
  state.line = next + (closed ? 1 : 0);
  return true;
}

function leafRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const m = LEAF_RE.exec(lineText(state, startLine));
  if (!m) return false;
  const name = m[1].toLowerCase();
  if (name !== 'video' && name !== 'roles') return false;
  if (silent) return true;
  const tok = state.push(`almanach_${name}`, 'div', 0);
  tok.block = true;
  tok.meta = parseInfo(name, m[2]);
  tok.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

// ───────────── Utilitaires de rendu ─────────────

const esc = (s: string) => MarkdownIt().utils.escapeHtml(s);

export function headUrl(head: string, size = 64): string {
  const h = head.trim();
  if (/^https:\/\//i.test(h)) return h;
  return `https://mc-heads.net/avatar/${encodeURIComponent(h)}/${size}`;
}

export function campColor(camp: string, camps: Camp[] = []): string {
  const found = camps.find((c) => c.name.trim().toLowerCase() === camp.trim().toLowerCase());
  if (found && /^#[0-9a-f]{6}$/i.test(found.color)) return found.color;
  // Couleur stable tirée du nom, dans la palette de la nuit.
  const palette = ['#8cc4ff', '#b49cff', '#6fd6b0', '#f5b85b', '#ff7b8a', '#7fd3e6', '#e7a6ff', '#c9d66f'];
  let h = 0;
  for (const ch of camp) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return camp ? palette[h % palette.length] : '#8c92b5';
}

export function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url.trim());
  return m ? m[1] : null;
}

const ICONS: Record<CalloutKind, string> = {
  info: '<path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="10"/>',
  astuce: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  attention: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  danger: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
};
const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const LINK_ICON = svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');

export function rolesGridHtml(roles: RoleRef[], camps: Camp[], base: string, space: string, filter = ''): string {
  const list = filter ? roles.filter((r) => r.camp.trim().toLowerCase() === filter.trim().toLowerCase()) : roles;
  if (!list.length) return '<p class="muted">Aucun rôle pour l’instant.</p>';
  const byCamp = new Map<string, RoleRef[]>();
  for (const r of list) {
    const k = r.camp.trim() || 'Sans camp';
    if (!byCamp.has(k)) byCamp.set(k, []);
    byCamp.get(k)!.push(r);
  }
  let out = '<div class="roles-index">';
  for (const [camp, rs] of byCamp) {
    const color = campColor(camp === 'Sans camp' ? '' : camp, camps);
    out += `<div class="roles-index__camp" style="--camp:${color}"><h4 class="roles-index__title"><span class="dot"></span>${esc(camp)} <span class="muted">· ${rs.length}</span></h4><ul>`;
    for (const r of rs) {
      const href = `${base}/${space}/${r.page ?? ''}#${r.anchor}`;
      out += `<li><a href="${esc(href)}" data-internal>${r.head ? `<img src="${esc(headUrl(r.head, 32))}" alt="" loading="lazy" width="20" height="20">` : '<span class="roles-index__nohead"></span>'}<span>${esc(r.name)}</span></a></li>`;
    }
    out += '</ul></div>';
  }
  return out + '</div>';
}

// ───────────── Moteur ─────────────

function createMd(): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });
  md.block.ruler.before('fence', 'almanach_container', containerRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.block.ruler.before('fence', 'almanach_leaf', leafRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  return md;
}

const MD = createMd();

export function renderMarkdown(src: string, ctx: RenderContext = {}): Rendered {
  const base = (ctx.base ?? '').replace(/\/$/, '');
  const camps = ctx.camps ?? [];
  const env = {};
  const tokens = MD.parse(src ?? '', env);
  const headings: Heading[] = [];
  const roles: RoleRef[] = [];
  const slugHeading = uniqueSlugger();
  const slugRole = uniqueSlugger();

  // Ancres des titres et des rôles, et cases à cocher des listes.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline.children?.map((c) => (c.type === 'text' || c.type === 'code_inline' ? c.content : '')).join('') ?? inline.content;
      const id = slugHeading(text);
      t.attrSet('id', id);
      const level = Number(t.tag.slice(1));
      if (level >= 2 && level <= 3) headings.push({ id, text, level });
    } else if (t.type === 'almanach_role_open') {
      const info = t.meta as BlockInfo;
      const name = roleName(info);
      if (!name) continue;
      const anchor = slugRole(name, 'role-');
      t.attrSet('id', anchor);
      roles.push({ name, camp: info.attrs.camp ?? '', head: info.attrs.tete ?? '', anchor, summary: '' });
      headings.push({ id: anchor, text: name, level: 3, kind: 'role' });
    } else if (t.type === 'inline' && tokens[i - 1]?.type === 'paragraph_open' && tokens[i - 2]?.type === 'list_item_open') {
      const first = t.children?.[0];
      const m = first?.type === 'text' ? /^\[([ xX])\]\s+/.exec(first.content) : null;
      if (m && first) {
        first.content = first.content.slice(m[0].length);
        tokens[i - 2].attrJoin('class', 'task');
        const box = new (t.constructor as unknown as { new (type: string, tag: string, nesting: number): Token })('html_inline', '', 0);
        box.content = `<span class="task__box${m[1] !== ' ' ? ' task__box--done' : ''}" aria-hidden="true"></span>`;
        t.children!.unshift(box);
      }
    }
  }

  const rules = MD.renderer.rules;
  const r = new MarkdownIt().renderer; // rendu de base pour les règles non surchargées
  const renderer = Object.create(MD.renderer) as typeof MD.renderer;
  renderer.rules = { ...rules };

  renderer.rules.heading_open = (tks, idx, opts, _env, self) => {
    return self.renderToken(tks, idx, opts);
  };
  renderer.rules.heading_close = (tks, idx, opts, _env, self) => {
    const open = tks[idx - 2];
    const id = open?.attrGet('id');
    const a = id && !ctx.editor ? `<a class="anchor" href="#${esc(id)}" aria-label="Lien vers cette section">${LINK_ICON}</a>` : '';
    return a + self.renderToken(tks, idx, opts);
  };

  renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  renderer.rules.table_close = () => '</table></div>\n';

  renderer.rules.link_open = (tks, idx, opts, _env, self) => {
    const t = tks[idx];
    const href = t.attrGet('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      t.attrSet('target', '_blank');
      t.attrSet('rel', 'noopener noreferrer');
    } else if (href.startsWith('/') && !href.startsWith('//')) {
      t.attrSet('href', base + href);
      t.attrSet('data-internal', '');
    } else if (href.startsWith('./') && ctx.space) {
      t.attrSet('href', `${base}/${ctx.space}/${href.slice(2)}`);
      t.attrSet('data-internal', '');
    }
    return self.renderToken(tks, idx, opts);
  };

  renderer.rules.image = (tks, idx) => {
    const t = tks[idx];
    const src = t.attrGet('src') ?? '';
    const alt = t.children?.map((c) => c.content).join('') ?? t.content;
    const title = t.attrGet('title');
    if (!/^https:\/\//i.test(src)) return esc(alt);
    return `<img src="${esc(src)}" alt="${esc(alt)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy" decoding="async">`;
  };

  renderer.rules.fence = (tks, idx, opts, env, self) => r.rules.fence!(tks, idx, opts, env, self);

  // Encadrés
  for (const kind of CALLOUTS) {
    renderer.rules[`almanach_${kind}_open`] = (tks, idx) => {
      const info = tks[idx].meta as BlockInfo;
      const title = info.label;
      const data = ctx.editor ? ` data-callout="${kind}" data-title="${esc(title)}"` : '';
      return `<aside class="callout callout--${kind}"${data}><span class="callout__icon">${svg(ICONS[kind])}</span><div class="callout__body">${
        title ? `<p class="callout__title">${esc(title)}</p>` : ''
      }`;
    };
    renderer.rules[`almanach_${kind}_close`] = () => '</div></aside>\n';
  }

  // Cartes de rôle
  renderer.rules.almanach_role_open = (tks, idx) => {
    const t = tks[idx];
    const info = t.meta as BlockInfo;
    const name = roleName(info) || 'Rôle';
    const camp = info.attrs.camp ?? '';
    const head = info.attrs.tete ?? '';
    const id = t.attrGet('id') ?? 'role-' + slugify(name);
    const color = campColor(camp, camps);
    const data = ctx.editor ? ` data-role="${esc(name)}" data-camp="${esc(camp)}" data-head="${esc(head)}"` : '';
    return `<section class="role" id="${esc(id)}" style="--camp:${color}"${data}><header class="role__head">${
      head ? `<img class="role__face" src="${esc(headUrl(head, 64))}" alt="" width="40" height="40" loading="lazy">` : `<span class="role__face role__face--empty">${esc(name.slice(0, 1).toUpperCase())}</span>`
    }<div class="role__names"><h3 class="role__name">${esc(name)}</h3>${camp ? `<span class="role__camp"><span class="dot"></span>${esc(camp)}</span>` : ''}</div>${
      ctx.editor ? '' : `<a class="role__link anchor" href="#${esc(id)}" aria-label="Lien vers ce rôle">${LINK_ICON}</a>`
    }</header><div class="role__body">`;
  };
  renderer.rules.almanach_role_close = () => '</div></section>\n';

  // Onglets : la barre est construite à partir des titres des onglets qui suivent.
  renderer.rules.almanach_tabs_open = (tks, idx) => {
    const labels: string[] = [];
    let depth = 0;
    for (let j = idx + 1; j < tks.length; j++) {
      const tt = tks[j];
      if (tt.type === 'almanach_tabs_open') depth++;
      if (tt.type === 'almanach_tabs_close') {
        if (depth === 0) break;
        depth--;
      }
      if (depth === 0 && tt.type === 'almanach_tab_open') labels.push((tt.meta as BlockInfo).label || `Onglet ${labels.length + 1}`);
    }
    if (ctx.editor) return '<div class="tabs" data-tabs>';
    return `<div class="tabs" data-tabs><div class="tabs__bar" role="tablist">${labels
      .map((l, k) => `<button type="button" role="tab" class="tabs__tab" aria-selected="${k === 0}" data-tab="${k}">${esc(l)}</button>`)
      .join('')}</div>`;
  };
  renderer.rules.almanach_tabs_close = () => '</div>\n';
  renderer.rules.almanach_tab_open = (tks, idx) => {
    const info = tks[idx].meta as BlockInfo;
    // Rang de l'onglet parmi ses frères.
    let k = 0;
    let depth = 0;
    for (let j = idx - 1; j >= 0; j--) {
      const tt = tks[j];
      if (tt.type === 'almanach_tab_close' && depth === 0) k++;
      if (tt.type === 'almanach_tabs_close') depth++;
      if (tt.type === 'almanach_tabs_open') {
        if (depth === 0) break;
        depth--;
      }
    }
    if (ctx.editor) return `<div class="tabs__panel" data-tab-title="${esc(info.label)}">`;
    return `<div class="tabs__panel" role="tabpanel" data-panel="${k}"${k > 0 ? ' hidden' : ''}><p class="tabs__print">${esc(info.label)}</p>`;
  };
  renderer.rules.almanach_tab_close = () => '</div>\n';

  // Dépliants
  renderer.rules.almanach_details_open = (tks, idx) => {
    const info = tks[idx].meta as BlockInfo;
    if (ctx.editor) return `<details class="fold" data-fold data-title="${esc(info.label)}" open><summary>${esc(info.label)}</summary><div class="fold__body">`;
    return `<details class="fold"><summary>${esc(info.label || 'Détails')}</summary><div class="fold__body">`;
  };
  renderer.rules.almanach_details_close = () => '</div></details>\n';

  // Vidéo et liste des rôles
  renderer.rules.almanach_video = (tks, idx) => {
    const url = (tks[idx].meta as BlockInfo).label;
    const id = youtubeId(url);
    if (ctx.editor) return `<div class="video" data-video="${esc(url)}"></div>`;
    if (!id) return /^https:\/\//i.test(url) ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></p>` : '';
    return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vidéo YouTube" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  };
  renderer.rules.almanach_roles = (tks, idx) => {
    const info = tks[idx].meta as BlockInfo;
    const filter = info.attrs.camp ?? '';
    if (ctx.editor) return `<div class="roles-embed" data-roles-index data-camp="${esc(filter)}"></div>`;
    return rolesGridHtml(ctx.roles ?? roles, camps, base, ctx.space ?? '', filter);
  };

  const html = renderer.render(tokens, MD.options, env);
  return { html, headings, roles };
}

// Texte brut (résumés, recherche locale, aperçus Discord).
export function plainText(src: string, max = 400): string {
  return (src ?? '')
    .replace(/^ {0,3}:{2,}.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Rôles d'une page, lus ligne à ligne comme docs_extract_roles() dans la base (résumé = première ligne qui suit).
export function extractRoles(src: string): RoleRef[] {
  const out: RoleRef[] = [];
  const slug = uniqueSlugger();
  let want = false;
  for (const line of (src ?? '').split('\n')) {
    const m = /^\s*:{3,}\s*role(\s.*|\[.*|\{.*)?$/i.exec(line);
    if (m) {
      const info = parseInfo('role', m[1] ?? '');
      const name = roleName(info);
      want = false;
      if (!name) continue;
      out.push({ name: name.slice(0, 80), camp: (info.attrs.camp ?? '').slice(0, 60), head: (info.attrs.tete ?? '').slice(0, 120), anchor: slug(name, 'role-'), summary: '' });
      want = true;
    } else if (want && line.trim()) {
      want = false;
      if (!/^\s*(:{2,}|!\[|\||#)/.test(line)) out[out.length - 1].summary = plainText(line, 220);
    }
  }
  return out;
}

// Icône d'un espace ou d'une page : emoji, adresse https d'une image, ou pseudo Minecraft (tête du skin).
export type IconSpec = { kind: 'none' } | { kind: 'emoji'; value: string } | { kind: 'image'; src: string };
export function iconSpec(icon: string | null | undefined, size = 64): IconSpec {
  const v = (icon ?? '').trim();
  if (!v) return { kind: 'none' };
  if (/^https:\/\//i.test(v)) return { kind: 'image', src: v };
  if (/^[A-Za-z0-9_]{2,16}$/.test(v)) return { kind: 'image', src: headUrl(v, size) };
  return { kind: 'emoji', value: v };
}
