// Moteur en mémoire : même interface que Supabase, pour la démo (?demo) et les tests du site.
// Tout est perdu au rechargement, rien ne part sur Internet.
import type { Api, DraftInput, PagePatch, PublishInput, SpacePatch } from './api.ts';
import { extractRoles } from './markdown.ts';
import { slugify } from './slug.ts';
import type { CatalogRow, ChangelogEntry, Draft, Member, Overview, Page, PageLite, Revision, SearchHit, Space, SpaceStatus, StatRow } from './types.ts';

const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type SpaceSeed = Partial<Space> & { slug: string; title: string; pages: PageSeed[]; status?: string };
type PageSeed = { slug: string; title: string; icon?: string; kind?: Page['kind']; description?: string; content?: string; children?: PageSeed[]; link_url?: string; visibility?: Page['visibility']; note?: string };

const LOVECRAFT_REGLES = `Une partie de **Lovecraft UHC** se joue à 12 joueurs ou plus. Chacun reçoit un rôle secret au bout de 20 minutes et doit faire gagner son camp.

:::info Commande du mode
Le mode se lance avec \`/l start\` une fois les joueurs dans le salon d'attente.
:::

## Déroulement

1. **Préparation** (20 min) : récolte, pas de combat.
2. **Révélation des rôles** : chaque joueur lit son rôle dans le chat.
3. **Bordure** : elle se resserre à partir de la 60ᵉ minute.

:::tabs
:::tab Jour
Les Investigateurs gagnent *Résistance I* et voient les traces des Grands Anciens.
:::
:::tab Nuit
Les Cultistes gagnent *Force I* et peuvent invoquer une fois par nuit.
:::
:::

:::attention Folie
Chaque mort vue de près fait monter la **Folie** de 1. À 5, le joueur entend des voix (messages trompeurs).
:::

## Conditions de victoire

| Camp | Gagne quand |
| --- | --- |
| Investigateurs | Tous les Cultistes et Grands Anciens sont morts |
| Culte | Le Grand Ancien est invoqué |
| Solitaires | Ils sont les derniers en vie |

:::details Que se passe-t-il en cas d'égalité ?
Si les deux derniers joueurs meurent en même temps, la partie est déclarée nulle.
:::

::video https://www.youtube.com/watch?v=dQw4w9WgXcQ
`;

const LOVECRAFT_ROLES = `Tous les rôles de la partie, rangés par camp.

::roles

## Investigateurs

:::role Randolph Carter {camp="Investigateurs" tete="Notch"}
Rêveur : chaque nuit, il apprend le camp d'un joueur proche.

- *Résistance I* permanent
- \`/l reve <joueur>\` une fois par nuit
:::

:::role Herbert West {camp="Investigateurs" tete="jeb_"}
Réanimateur : peut ramener un joueur mort une seule fois dans la partie.
:::

## Culte

:::role Grand Prêtre {camp="Culte" tete="Dinnerbone"}
Connaît les autres Cultistes et peut lancer l'invocation au centre de la carte.
:::

:::role Profond {camp="Culte"}
Respire sous l'eau et nage très vite.
:::

## Solitaires

:::role Nyarlathotep {camp="Solitaires" tete="Grumm"}
Change de visage : prend le pseudo d'un joueur tué pendant 5 minutes.
:::
`;

const SEEDS: SpaceSeed[] = [
  {
    slug: 'lovecraft',
    title: 'Lovecraft UHC',
    tagline: 'Investigateurs contre Culte : survivre à la folie avant l’invocation.',
    kind: 'mode',
    icon: 'Notch',
    color: '#7fd3e6',
    family: 'lovecraft',
    version_label: 'V1',
    universe: 'H. P. Lovecraft',
    credits: 'Idée originale de Jules (Ora)',
    mc_version: '1.8.9',
    command: '/l',
    players: '12 à 40',
    camps: [
      { name: 'Investigateurs', color: '#8cc4ff' },
      { name: 'Culte', color: '#ff7b8a' },
      { name: 'Solitaires', color: '#b49cff' },
    ],
    catalog_key: 'lovecraft',
    status: 'fait',
    pages: [
      { slug: 'presentation', title: 'Présentation', icon: '🌊', description: 'Le mode en deux minutes.', content: 'Bienvenue dans **Lovecraft UHC**, un mode à rôles inspiré du mythe de Cthulhu.\n\n:::astuce Première partie ?\nLis d’abord [les règles](./regles), puis [les rôles](./roles).\n:::\n\n## En bref\n\n- 3 camps, 26 rôles\n- Parties de 90 minutes environ\n- Carte générée par le plugin', note: 'Première version' },
      { slug: 'regles', title: 'Règles', icon: '📜', description: 'Déroulement, folie et conditions de victoire.', content: LOVECRAFT_REGLES, note: 'Ajout de la Folie' },
      { slug: 'roles', title: 'Rôles', icon: '🎭', description: 'Les 26 rôles, camp par camp.', content: LOVECRAFT_ROLES, note: 'Nyarlathotep rejoint les Solitaires' },
      {
        slug: 'annexes', title: 'Annexes', kind: 'group', children: [
          { slug: 'faq', title: 'Questions fréquentes', icon: '❓', content: ':::details Peut-on jouer en équipe ?\nNon, les rôles sont individuels.\n:::\n\n:::details Le mode marche-t-il en 1.20 ?\nPas encore : 1.8.9 seulement.\n:::' },
          { slug: 'notes-equipe', title: 'Notes de l’équipe', icon: '🔒', visibility: 'equipe', content: 'Équilibrage à revoir : le Profond est trop fort sur les cartes océan.' },
          { slug: 'tableau', title: 'Fiche dans Tsuki', kind: 'link', link_url: 'https://github.com/ORA-KUN' },
        ],
      },
    ],
  },
  {
    slug: 'wakfu',
    title: 'Wakfu UHC',
    tagline: 'Retrouver les six Dofus avant les autres.',
    kind: 'mode',
    icon: 'jeb_',
    color: '#6fd6b0',
    family: 'wakfu',
    version_label: 'V1',
    universe: 'Wakfu',
    credits: 'Doc d’Ora et R2',
    mc_version: '1.8.9',
    command: '/wk',
    players: '10 à 30',
    camps: [{ name: 'Confrérie du Tofu', color: '#6fd6b0' }, { name: 'Nox', color: '#f5b85b' }],
    catalog_key: 'wakfu',
    status: 'en_cours',
    pages: [{ slug: 'presentation', title: 'Présentation', icon: '🥚', content: 'Six **Dofus** sont cachés sur la carte. Chaque Dofus donne un pouvoir à son porteur.\n\n:::role Yugo {camp="Confrérie du Tofu" tete="Notch"}\nOuvre des portails entre deux points.\n:::\n\n:::role Nox {camp="Nox" tete="Dinnerbone"}\nRemonte le temps de 10 secondes une fois par partie.\n:::' }],
  },
  {
    slug: 'wakfu-v2',
    title: 'Wakfu UHC',
    tagline: 'La version 2, avec les Éliatropes.',
    kind: 'mode',
    icon: 'jeb_',
    color: '#6fd6b0',
    family: 'wakfu',
    version_label: 'V2 (bêta)',
    universe: 'Wakfu',
    mc_version: '1.8.9',
    command: '/wk',
    pages: [{ slug: 'presentation', title: 'Présentation', icon: '✨', content: 'Brouillon de la V2.' }],
  },
  {
    slug: 'bien-debuter',
    title: 'Bien débuter',
    tagline: 'Rejoindre une partie, lire son rôle, utiliser les commandes.',
    kind: 'guide',
    icon: '🌙',
    color: '#b49cff',
    pages: [
      { slug: 'rejoindre', title: 'Rejoindre une partie', icon: '🚪', content: 'Connecte-toi au serveur en **1.8.9**, puis attends l’annonce du host sur Discord.\n\n- [x] Minecraft 1.8.9 installé\n- [ ] Pack de ressources accepté\n\n:::danger Triche\nTout client modifié donne un bannissement définitif.\n:::' },
      { slug: 'commandes', title: 'Commandes utiles', icon: '⌨️', content: '| Commande | Effet |\n| --- | --- |\n| `/role` | Revoir son rôle |\n| `/camp` | Revoir son camp |' },
    ],
  },
];

export class MemoryApi implements Api {
  readonly mode = 'demo' as const;
  private spacesList: Space[] = [];
  private pagesList: Page[] = [];
  private draftsMap = new Map<string, Draft>();
  private revs: Revision[] = [];
  private status_: SpaceStatus[] = [];
  private statsRows: StatRow[] = [];
  private member: Member | null = null;
  private listeners = new Set<() => void>();
  private revId = 1;

  constructor() {
    SEEDS.forEach((s, i) => {
      const { pages, status, ...rest } = s;
      const space: Space = {
        id: uid(), tagline: '', kind: 'mode', icon: '', color: '#8cc4ff', cover_url: null, family: '', version_label: '', universe: '', credits: '',
        origin_url: null, mc_version: '', command: '', players: '', camps: [], catalog_key: null, mode_id: null, visibility: 'public',
        published: s.slug !== 'wakfu-v2', archived: false, position: i, updated_at: days(i + 1), ...rest,
      };
      this.spacesList.push(space);
      if (status) this.status_.push({ space_id: space.id, status });
      this.seedPages(space, pages, null, i);
    });
    try {
      if (sessionStorage.getItem('almanach-demo-member') === '1') this.member = this.demoMember();
    } catch {
      /* rien */
    }
    // Une proposition de Claude en attente, pour la démo de l'espace équipe.
    const regles = this.pagesList.find((p) => p.slug === 'regles')!;
    this.draftsMap.set(regles.id, {
      page_id: regles.id, title: regles.title, description: regles.description, icon: regles.icon,
      content: regles.content.replace('À 5, le joueur entend des voix', 'À 4, le joueur entend des voix'),
      base_revision: regles.revision - 1, author: null, author_label: 'Claude', source: 'claude', note: 'Folie : seuil abaissé à 4 (retour des tests)', updated_at: days(0.2),
    });
    for (const p of this.pagesList.filter((x) => x.kind === 'page')) {
      for (let d = 0; d < 30; d++) {
        const views = Math.max(0, Math.round((Math.sin(d / 3 + p.slug.length) + 1.4) * (p.slug === 'roles' ? 18 : 7)));
        if (views) this.statsRows.push({ page_id: p.id, day: days(d).slice(0, 10), views, up: d % 6 === 0 ? 1 : 0, down: d % 17 === 0 ? 1 : 0 });
      }
    }
  }

  private seedPages(space: Space, seeds: PageSeed[], parent: string | null, age: number) {
    seeds.forEach((ps, k) => {
      const kind = ps.kind ?? 'page';
      const content = ps.content ?? '';
      const page: Page = {
        id: uid(), space_id: space.id, parent_id: parent, slug: ps.slug, title: ps.title, icon: ps.icon ?? '', kind, link_url: ps.link_url ?? null,
        description: ps.description ?? '', content, roles: extractRoles(content), visibility: ps.visibility ?? 'public', hidden: false, archived: false,
        position: k + 1, revision: kind === 'page' ? 2 : 0, published_at: days(age + 3), updated_at: days(age + k * 0.3),
      };
      this.pagesList.push(page);
      if (kind === 'page') {
        this.revs.push({ id: this.revId++, page_id: page.id, revision: 1, title: page.title, description: page.description, icon: page.icon, content: content.split('\n').slice(0, 3).join('\n'), author_label: 'Jules', source: 'site', note: '', created_at: days(age + 3) });
        this.revs.push({ id: this.revId++, page_id: page.id, revision: 2, title: page.title, description: page.description, icon: page.icon, content, author_label: 'Claude', source: 'claude', note: ps.note ?? '', created_at: page.updated_at });
      }
      if (ps.children) this.seedPages(space, ps.children, page.id, age);
    });
  }

  private demoMember(): Member {
    return { id: 'demo', email: 'demo@tsuki.local', pseudo: 'Ora (démo)', mc_name: 'Notch', admin: true };
  }
  private wait<T>(v: T): Promise<T> {
    return new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));
  }
  private needMember() {
    if (!this.member) throw new Error('Action réservée à l’équipe Tsuki.');
  }
  private visibleSpace(s: Space) {
    return !!this.member || (s.published && !s.archived && s.visibility === 'public');
  }
  private visiblePage(p: Page) {
    const s = this.spacesList.find((x) => x.id === p.space_id);
    if (!s) return false;
    if (this.member) return true;
    return this.visibleSpace(s) && !!p.published_at && !p.archived && p.visibility === 'public';
  }
  private freeSlug(spaceId: string, wanted: string, except?: string) {
    const base = slugify(wanted) || 'page';
    let s = base;
    let n = 2;
    while (this.pagesList.some((p) => p.space_id === spaceId && p.slug === s && p.id !== except)) s = `${base}-${n++}`;
    return s;
  }

  async spaces() {
    return this.wait(this.spacesList.filter((s) => this.visibleSpace(s)).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)));
  }
  async overview() {
    const out: Overview[] = [];
    for (const s of this.spacesList.filter((x) => this.visibleSpace(x))) {
      const ps = this.pagesList.filter((p) => p.space_id === s.id && !p.archived && p.published_at && this.visiblePage(p));
      out.push({ space_id: s.id, pages: ps.filter((p) => p.kind === 'page').length, roles: ps.reduce((n, p) => n + p.roles.length, 0), updated_at: ps.map((p) => p.updated_at).sort().pop() ?? null });
    }
    return this.wait(out);
  }
  async status() {
    return this.wait(this.status_.filter((st) => this.spacesList.some((s) => s.id === st.space_id && this.visibleSpace(s))));
  }
  async pages(spaceId: string) {
    return this.wait(this.pagesList.filter((p) => p.space_id === spaceId && this.visiblePage(p)).sort((a, b) => a.position - b.position));
  }
  async search(q: string, spaceId?: string) {
    const nq = norm(q.trim());
    if (nq.length < 2) return [];
    const words = nq.split(/\s+/).filter(Boolean);
    const hits: SearchHit[] = [];
    for (const p of this.pagesList) {
      if (p.archived || !p.published_at || !this.visiblePage(p) || (spaceId && p.space_id !== spaceId)) continue;
      const s = this.spacesList.find((x) => x.id === p.space_id)!;
      const base = { page_id: p.id, space_id: s.id, space_slug: s.slug, space_title: s.title, space_icon: s.icon, page_slug: p.slug };
      for (const r of p.roles) {
        if (words.every((w) => norm(r.name).includes(w))) hits.push({ ...base, kind: 'role', title: r.name, icon: r.head, anchor: r.anchor, camp: r.camp, snippet: r.summary, score: 2 });
      }
      if (p.kind !== 'page') continue;
      const text = norm(p.title + ' ' + p.content);
      if (words.every((w) => text.includes(w))) {
        const i = norm(p.content).indexOf(words[0]);
        const snippet = i >= 0 ? p.content.slice(Math.max(0, i - 50), i + 90).replace(/:::?[a-z]+/g, ' ').replace(/\{[^}\n]*\}/g, ' ').replace(/[#*:`|]+/g, ' ').replace(new RegExp(words[0], 'i'), (m) => `«${m}»`) : p.description;
        hits.push({ ...base, kind: 'page', title: p.title, icon: p.icon, anchor: null, camp: null, snippet, score: norm(p.title).includes(words[0]) ? 1.5 : 1 });
      }
    }
    return this.wait(hits.sort((a, b) => b.score - a.score).slice(0, 20));
  }
  async changelog(limit = 40) {
    const out: ChangelogEntry[] = [];
    for (const r of [...this.revs].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const p = this.pagesList.find((x) => x.id === r.page_id);
      if (!p || !r.note.trim() || !this.visiblePage(p)) continue;
      const s = this.spacesList.find((x) => x.id === p.space_id)!;
      out.push({ space_slug: s.slug, space_title: s.title, space_icon: s.icon, page_slug: p.slug, page_title: r.title, revision: r.revision, note: r.note, author_label: this.member ? r.author_label : '', created_at: r.created_at });
    }
    return this.wait(out.slice(0, limit));
  }
  async hit() {}
  async vote() {}

  async me() {
    return this.wait(this.member);
  }
  onAuthChange(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  async signIn(email: string, password: string) {
    if (!email.includes('@') || password.length < 1) throw new Error('Adresse ou mot de passe incorrect.');
    this.member = this.demoMember();
    try {
      sessionStorage.setItem('almanach-demo-member', '1');
    } catch {
      /* rien */
    }
    this.listeners.forEach((l) => l());
  }
  async signOut() {
    this.member = null;
    try {
      sessionStorage.removeItem('almanach-demo-member');
    } catch {
      /* rien */
    }
    this.listeners.forEach((l) => l());
  }

  async pageIndex(): Promise<PageLite[]> {
    this.needMember();
    return this.wait(this.pagesList.map(({ content: _c, roles: _r, description: _d, link_url: _l, position: _p, ...lite }) => lite));
  }
  async drafts() {
    this.needMember();
    return this.wait([...this.draftsMap.values()].filter((d) => d.content !== null).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }
  async saveDraft(pageId: string, d: DraftInput) {
    this.needMember();
    const old = this.draftsMap.get(pageId);
    const at = now();
    this.draftsMap.set(pageId, {
      page_id: pageId, title: d.title, description: d.description, icon: d.icon, content: d.content,
      base_revision: old && old.content !== null ? old.base_revision : d.base, author: 'demo', author_label: this.member!.pseudo, source: 'site', note: '', updated_at: at,
    });
    return at;
  }
  async discardDraft(pageId: string) {
    this.needMember();
    const d = this.draftsMap.get(pageId);
    if (d) d.content = null;
  }
  private write(p: Page, title: string, description: string, icon: string, content: string, note: string, source: Revision['source']) {
    p.title = title.trim() || p.title;
    p.description = description.trim();
    p.icon = icon;
    p.content = content;
    p.roles = extractRoles(content);
    p.revision += 1;
    p.published_at ??= now();
    p.updated_at = now();
    this.revs.push({ id: this.revId++, page_id: p.id, revision: p.revision, title: p.title, description: p.description, icon: p.icon, content, author_label: this.member!.pseudo, source, note: note.trim(), created_at: now() });
    const d = this.draftsMap.get(p.id);
    if (d) d.content = null;
    return p.revision;
  }
  async publish(pageId: string, i: PublishInput) {
    this.needMember();
    const p = this.pagesList.find((x) => x.id === pageId);
    if (!p) throw new Error('Page introuvable.');
    if (p.revision !== i.base && !i.force) throw new Error(`conflit:${p.revision}`);
    return this.wait(this.write(p, i.title, i.description, i.icon, i.content, i.note, 'site'));
  }
  async revisions(pageId: string) {
    this.needMember();
    return this.wait(this.revs.filter((r) => r.page_id === pageId).sort((a, b) => b.revision - a.revision));
  }
  async restore(pageId: string, revision: number) {
    this.needMember();
    const p = this.pagesList.find((x) => x.id === pageId)!;
    const r = this.revs.find((x) => x.page_id === pageId && x.revision === revision);
    if (!r) throw new Error('Version introuvable.');
    return this.wait(this.write(p, r.title, r.description, r.icon, r.content, `Retour à la version ${revision}`, 'restauration'));
  }
  async createPage(spaceId: string, parentId: string | null, title: string, kind: Page['kind'] = 'page', linkUrl: string | null = null) {
    this.needMember();
    const siblings = this.pagesList.filter((p) => p.space_id === spaceId && p.parent_id === parentId);
    const page: Page = {
      id: uid(), space_id: spaceId, parent_id: parentId, slug: this.freeSlug(spaceId, title), title: title.trim() || 'Nouvelle page', icon: '', kind, link_url: linkUrl,
      description: '', content: '', roles: [], visibility: 'public', hidden: false, archived: false, position: Math.max(0, ...siblings.map((s) => s.position)) + 1,
      revision: 0, published_at: kind === 'page' ? null : now(), updated_at: now(),
    };
    this.pagesList.push(page);
    return this.wait(page.id);
  }
  async updatePage(pageId: string, patch: PagePatch) {
    this.needMember();
    const p = this.pagesList.find((x) => x.id === pageId);
    if (!p) throw new Error('Page introuvable.');
    if (patch.slug !== undefined) {
      const s = slugify(patch.slug);
      if (!s) throw new Error('Adresse invalide : lettres minuscules, chiffres et tirets seulement.');
      if (this.pagesList.some((x) => x.space_id === p.space_id && x.slug === s && x.id !== p.id)) throw new Error('Cette adresse est déjà prise.');
      patch = { ...patch, slug: s };
    }
    if (patch.parent_id) {
      let cur: string | null = patch.parent_id;
      while (cur) {
        if (cur === p.id) throw new Error('Une page ne peut pas être rangée dans elle-même.');
        cur = this.pagesList.find((x) => x.id === cur)?.parent_id ?? null;
      }
    }
    Object.assign(p, patch, { updated_at: now() });
    if (patch.archived !== undefined) {
      const cascade = (id: string) => this.pagesList.filter((x) => x.parent_id === id).forEach((c) => { c.archived = !!patch.archived; cascade(c.id); });
      cascade(p.id);
    }
  }
  async createSpace(patch: SpacePatch & { slug: string; title: string }) {
    this.needMember();
    const slug = slugify(patch.slug);
    if (this.spacesList.some((s) => s.slug === slug)) throw new Error('Cette adresse est déjà prise.');
    const space: Space = {
      id: uid(), tagline: '', kind: 'mode', icon: '', color: '#8cc4ff', cover_url: null, family: '', version_label: '', universe: '', credits: '', origin_url: null,
      mc_version: '1.8.9', command: '', players: '', camps: [], catalog_key: null, mode_id: null, visibility: 'public', published: false, archived: false,
      position: this.spacesList.length, updated_at: now(), ...patch, slug,
    };
    this.spacesList.push(space);
    return this.wait(space.id);
  }
  async updateSpace(spaceId: string, patch: SpacePatch) {
    this.needMember();
    const s = this.spacesList.find((x) => x.id === spaceId);
    if (!s) throw new Error('Espace introuvable.');
    if (patch.slug !== undefined) {
      const slug = slugify(patch.slug);
      if (this.spacesList.some((x) => x.slug === slug && x.id !== spaceId)) throw new Error('Cette adresse est déjà prise.');
      patch = { ...patch, slug };
    }
    Object.assign(s, patch, { updated_at: now() });
  }
  async uploadImage(file: File) {
    this.needMember();
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Image illisible.'));
      r.readAsDataURL(file);
    });
  }
  async stats(sinceDays = 30) {
    this.needMember();
    const since = days(sinceDays).slice(0, 10);
    return this.wait(this.statsRows.filter((r) => r.day >= since));
  }
  async catalog(): Promise<CatalogRow[]> {
    this.needMember();
    return this.wait([
      { seed_key: 'lovecraft', name: 'Lovecraft UHC', version: 'V1', creator: 'Ora', mc_version: '1.8.9', status: 'fait', mode_id: 'lovecraft', doc_url: null },
      { seed_key: 'wakfu', name: 'Wakfu UHC', version: 'V1', creator: 'Ora & R2', mc_version: '1.8.9', status: 'en_cours', mode_id: 'wakfu', doc_url: null },
      { seed_key: 'fate', name: 'Fate UHC', version: 'V2', creator: 'Weatheria', mc_version: '1.8.9', status: 'fait', mode_id: 'fate', doc_url: 'https://claude.ai/artifact/G1a9rMhVPxesCZz9hMf6P6' },
      { seed_key: 'soul-brothers', name: 'Soul Brothers UHC', version: 'V1', creator: 'Guill', mc_version: '1.8.9', status: 'fait', mode_id: 'soul_brothers', doc_url: null },
    ]);
  }
  private github: string | null = null;
  async githubLogin() {
    this.needMember();
    return this.wait(this.github);
  }
  async setGithubLogin(login: string) {
    this.needMember();
    const v = login.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/^@/, '').replace(/\/.*$/, '');
    if (v && !/^[a-z0-9](-?[a-z0-9]){0,38}$/.test(v)) throw new Error('Pseudo GitHub invalide : lettres, chiffres et tirets seulement.');
    this.github = v || null;
    return this.wait(this.github);
  }
}
