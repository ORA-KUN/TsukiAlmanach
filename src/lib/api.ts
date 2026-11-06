// Accès aux données de l'Almanach. Deux moteurs, même interface :
// · Supabase (le vrai site, base de Tsuki) ;
// · mémoire (démo et tests, ?demo dans l'adresse ou VITE_DEMO=1).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminMember, CatalogRow, ChangelogEntry, Draft, Member, Overview, Page, PageLite, Revision, SearchHit, Space, SpaceStatus, StatRow } from './types.ts';

export type PublishInput = { title: string; description: string; icon: string; content: string; note: string; base: number; force?: boolean };
export type DraftInput = { title: string; description: string; icon: string; content: string; base: number };
export type SpacePatch = Partial<Omit<Space, 'id' | 'updated_at'>>;
export type PagePatch = Partial<Pick<Page, 'parent_id' | 'slug' | 'title' | 'icon' | 'kind' | 'link_url' | 'visibility' | 'hidden' | 'archived' | 'position'>>;

export interface Api {
  readonly mode: 'supabase' | 'demo';
  // Lecture
  spaces(): Promise<Space[]>;
  overview(): Promise<Overview[]>;
  status(): Promise<SpaceStatus[]>;
  pages(spaceId: string): Promise<Page[]>;
  search(q: string, spaceId?: string): Promise<SearchHit[]>;
  changelog(limit?: number): Promise<ChangelogEntry[]>;
  hit(pageId: string): Promise<void>;
  vote(pageId: string, up: boolean): Promise<void>;
  // Compte
  me(): Promise<Member | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  // Équipe
  pageIndex(): Promise<PageLite[]>;
  drafts(): Promise<Draft[]>;
  saveDraft(pageId: string, d: DraftInput): Promise<string>;
  discardDraft(pageId: string): Promise<void>;
  publish(pageId: string, p: PublishInput): Promise<number>;
  revisions(pageId: string): Promise<Revision[]>;
  restore(pageId: string, revision: number): Promise<number>;
  createPage(spaceId: string, parentId: string | null, title: string, kind?: Page['kind'], linkUrl?: string | null): Promise<string>;
  updatePage(pageId: string, patch: PagePatch): Promise<void>;
  createSpace(patch: SpacePatch & { slug: string; title: string }): Promise<string>;
  updateSpace(spaceId: string, patch: SpacePatch): Promise<void>;
  uploadImage(file: File, folder: string): Promise<string>;
  stats(sinceDays?: number): Promise<StatRow[]>;
  catalog(): Promise<CatalogRow[]>;
  // Envoi par Claude depuis GitHub : compte GitHub relié au membre connecté.
  githubLogin(): Promise<string | null>;
  setGithubLogin(login: string): Promise<string | null>;
  // Onglet Membres (admins) : mêmes garde-fous que Tsuki, vérifiés par la base.
  adminMembers(): Promise<AdminMember[]>;
  adminSetEmail(id: string, email: string): Promise<string>;
  adminSetPassword(id: string, password: string): Promise<void>;
  adminSetRole(id: string, role: AdminMember['role']): Promise<string>;
  adminSetGithub(id: string, login: string): Promise<string | null>;
}

const LITE_COLUMNS = 'id, space_id, parent_id, slug, title, icon, kind, archived, hidden, visibility, revision, published_at, updated_at';
const PAGE_COLUMNS =
  'id, space_id, parent_id, slug, title, icon, kind, link_url, description, content, roles, visibility, hidden, archived, position, revision, published_at, updated_at';

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/Invalid login credentials/i.test(msg)) return 'Adresse ou mot de passe incorrect.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Pas de connexion à la base. Vérifie ta connexion internet.';
  if (/duplicate key.*slug/i.test(msg)) return 'Cette adresse est déjà prise.';
  if (/check constraint.*slug/i.test(msg)) return 'Adresse invalide : lettres minuscules, chiffres et tirets seulement.';
  if (/permission denied|row-level security/i.test(msg)) return 'Action réservée à l’équipe Tsuki.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}

class SupabaseApi implements Api {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, storageKey: 'almanach-auth', autoRefreshToken: true } });
  }

  private async run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(friendlyError(error));
    return data as T;
  }

  async spaces() {
    return (await this.run(this.sb.from('docs_spaces').select('*').order('position').order('title'))) as Space[];
  }
  async overview() {
    return (await this.run(this.sb.rpc('docs_overview'))) as Overview[];
  }
  async status() {
    return ((await this.run(this.sb.rpc('docs_space_status'))) as SpaceStatus[]) ?? [];
  }
  async pages(spaceId: string) {
    return (await this.run(this.sb.from('docs_pages').select(PAGE_COLUMNS).eq('space_id', spaceId).order('position'))) as Page[];
  }
  async search(q: string, spaceId?: string) {
    return ((await this.run(this.sb.rpc('docs_search', { q, p_space: spaceId ?? null, p_limit: 20 }))) as SearchHit[]) ?? [];
  }
  async changelog(limit = 40) {
    return ((await this.run(this.sb.rpc('docs_changelog', { p_limit: limit }))) as ChangelogEntry[]) ?? [];
  }
  async hit(pageId: string) {
    await this.sb.rpc('docs_hit', { p_page: pageId });
  }
  async vote(pageId: string, up: boolean) {
    await this.sb.rpc('docs_vote', { p_page: pageId, p_up: up });
  }

  async me(): Promise<Member | null> {
    const { data } = await this.sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const [{ data: member }, { data: admin }, { data: profile }] = await Promise.all([
      this.sb.rpc('docs_member'),
      this.sb.rpc('docs_admin'),
      this.sb.from('profiles').select('pseudo, mc_name').eq('id', user.id).maybeSingle(),
    ]);
    if (!member) return null;
    return { id: user.id, email: user.email ?? '', pseudo: profile?.pseudo ?? user.email ?? 'Membre', mc_name: profile?.mc_name ?? null, admin: !!admin };
  }
  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb();
    });
    return () => data.subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(friendlyError(error));
    const m = await this.me();
    if (!m) {
      await this.sb.auth.signOut();
      throw new Error('Ce compte n’est pas (ou plus) membre de l’équipe Tsuki.');
    }
  }
  async signOut() {
    await this.sb.auth.signOut();
  }

  async pageIndex() {
    return (await this.run(this.sb.from('docs_pages').select(LITE_COLUMNS).order('position').limit(5000))) as PageLite[];
  }
  async drafts() {
    return (await this.run(this.sb.from('docs_drafts').select('*').not('content', 'is', null).order('updated_at', { ascending: false }))) as Draft[];
  }
  async saveDraft(pageId: string, d: DraftInput) {
    return (await this.run(
      this.sb.rpc('docs_save_draft', { p_page: pageId, p_title: d.title, p_description: d.description, p_icon: d.icon, p_content: d.content, p_base: d.base }),
    )) as string;
  }
  async discardDraft(pageId: string) {
    await this.run(this.sb.rpc('docs_discard_draft', { p_page: pageId }));
  }
  async publish(pageId: string, p: PublishInput) {
    return (await this.run(
      this.sb.rpc('docs_publish', {
        p_page: pageId, p_title: p.title, p_description: p.description, p_icon: p.icon, p_content: p.content, p_note: p.note, p_base: p.base, p_force: !!p.force,
      }),
    )) as number;
  }
  async revisions(pageId: string) {
    return (await this.run(this.sb.from('docs_revisions').select('*').eq('page_id', pageId).order('revision', { ascending: false }).limit(200))) as Revision[];
  }
  async restore(pageId: string, revision: number) {
    return (await this.run(this.sb.rpc('docs_restore', { p_page: pageId, p_revision: revision }))) as number;
  }
  async createPage(spaceId: string, parentId: string | null, title: string, kind: Page['kind'] = 'page', linkUrl: string | null = null) {
    return (await this.run(this.sb.rpc('docs_create_page', { p_space: spaceId, p_parent: parentId, p_title: title, p_kind: kind, p_link_url: linkUrl }))) as string;
  }
  async updatePage(pageId: string, patch: PagePatch) {
    await this.run(this.sb.from('docs_pages').update(patch).eq('id', pageId));
  }
  async createSpace(patch: SpacePatch & { slug: string; title: string }) {
    const row = (await this.run(this.sb.from('docs_spaces').insert(patch).select('id').single())) as { id: string };
    return row.id;
  }
  async updateSpace(spaceId: string, patch: SpacePatch) {
    await this.run(this.sb.from('docs_spaces').update(patch).eq('id', spaceId));
  }
  async uploadImage(file: File, folder: string) {
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await this.sb.storage.from('docs').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(friendlyError(error));
    return this.sb.storage.from('docs').getPublicUrl(path).data.publicUrl;
  }
  async stats(sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
    return (await this.run(this.sb.from('docs_stats').select('*').gte('day', since))) as StatRow[];
  }
  async catalog() {
    return (await this.run(
      this.sb.from('catalog').select('seed_key, name, version, creator, mc_version, status, mode_id, doc_url').eq('section', 'uhc').order('name'),
    )) as CatalogRow[];
  }
  async githubLogin() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) return null;
    const row = (await this.run(this.sb.from('docs_git_authors').select('github_login').eq('member_id', id).maybeSingle())) as { github_login: string | null } | null;
    return row?.github_login ?? null;
  }
  async setGithubLogin(login: string) {
    return (await this.run(this.sb.rpc('docs_set_github', { p_login: login }))) as string | null;
  }
  async adminMembers() {
    return ((await this.run(this.sb.rpc('docs_admin_members'))) ?? []) as AdminMember[];
  }
  async adminSetEmail(id: string, email: string) {
    return (await this.run(this.sb.rpc('docs_admin_set_email', { p_target: id, p_email: email }))) as string;
  }
  async adminSetPassword(id: string, password: string) {
    await this.run(this.sb.rpc('admin_set_password', { target: id, new_password: password }));
  }
  async adminSetRole(id: string, role: AdminMember['role']) {
    return (await this.run(this.sb.rpc('docs_admin_set_role', { p_target: id, p_role: role }))) as string;
  }
  async adminSetGithub(id: string, login: string) {
    return (await this.run(this.sb.rpc('docs_admin_set_github', { p_target: id, p_login: login }))) as string | null;
  }
}

let instance: Api | null = null;

export async function getApi(): Promise<Api> {
  if (instance) return instance;
  const demo = import.meta.env.VITE_DEMO === '1' || new URLSearchParams(location.search).has('demo') || sessionStorage.getItem('almanach-demo') === '1';
  if (demo) {
    try {
      sessionStorage.setItem('almanach-demo', '1');
    } catch {
      /* navigation privée */
    }
    const { MemoryApi } = await import('./demo.ts');
    instance = new MemoryApi();
  } else {
    instance = new SupabaseApi(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);
  }
  return instance;
}
