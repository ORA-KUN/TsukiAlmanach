-- Almanach (Tsuki Docs) · base du site de documentation des modes (projet Supabase « tsuki »).
--
-- · docs_spaces    : un espace par mode (ou guide), relié à sa ligne du tableau des modes de Tsuki.
-- · docs_pages     : l'arbre des pages d'un espace ; « content » est toujours la version PUBLIÉE (Markdown).
-- · docs_drafts    : brouillons en cours, visibles des seuls membres.
-- · docs_revisions : chaque version publiée (historique, différences, restauration).
-- · docs_stats     : vues par jour et votes « utile / pas utile ».
-- · docs_settings  : adresse du site et réglages.
--
-- Lecture : tout le monde voit les espaces publiés et publics ; les membres de Tsuki voient tout.
-- Écriture : membres de Tsuki seulement (is_member()), jamais d'effacement réel (corbeille + historique).
-- Rejouable sans perte. Volontairement sans aucune instruction destructive.

create extension if not exists unaccent schema extensions;
create extension if not exists pg_trgm schema extensions;

-- Recherche en français, sans tenir compte des accents.
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'docs_fr') then
    create text search configuration public.docs_fr (copy = pg_catalog.french);
    alter text search configuration public.docs_fr
      alter mapping for hword, hword_part, word with extensions.unaccent, french_stem;
  end if;
end $$;

-- Même règle que le site (src/lib/slug.ts) : minuscules, sans accents, tirets.
create or replace function public.docs_slugify(t text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select left(btrim(regexp_replace(
    replace(replace(replace(lower(extensions.unaccent(coalesce(t, ''))), 'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'),
    '[^a-z0-9]+', '-', 'g'), '-'), 60)
$$;

-- Texte brut d'une page pour la recherche (sans la syntaxe Markdown ni les liens).
create or replace function public.docs_plain(t text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    'https?://[^[:space:])]+', ' ', 'g'),
    '\{[^}\n]*\}', ' ', 'g'),
    '[#*_`>|\[\]()=:"~]+', ' ', 'g')
$$;

-- ───────────── Réglages ─────────────
create table if not exists public.docs_settings (
  id integer primary key default 1 check (id = 1),
  site_url text not null default 'https://ora-kun.github.io/TsukiAlmanach' check (site_url ~ '^https://[^[:space:]]+[^/]$'),
  -- Une fois le site en ligne : la coche « Doc » du tableau de Tsuki ouvre la page Tsuki Docs du mode.
  link_catalog boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.docs_settings (id) values (1) on conflict (id) do nothing;

-- ───────────── Espaces ─────────────
create table if not exists public.docs_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60
    and slug not in ('equipe', 'nouveautes', 'recherche', 'assets', 'api', 'llms', 'roles')),
  title text not null check (length(btrim(title)) between 1 and 120),
  tagline text not null default '' check (length(tagline) <= 300),
  kind text not null default 'mode' check (kind in ('mode', 'guide')),
  icon text not null default '' check (length(icon) <= 400),
  color text not null default '#b49cff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  cover_url text check (cover_url is null or (cover_url ~* '^https://[^[:space:]]+$' and length(cover_url) <= 600)),
  family text not null default '' check (length(family) <= 80),
  version_label text not null default '' check (length(version_label) <= 40),
  universe text not null default '' check (length(universe) <= 80),
  credits text not null default '' check (length(credits) <= 1200),
  origin_url text check (origin_url is null or (origin_url ~* '^https?://[^[:space:]]+$' and length(origin_url) <= 600)),
  mc_version text not null default '' check (length(mc_version) <= 40),
  command text not null default '' check (length(command) <= 80),
  players text not null default '' check (length(players) <= 40),
  camps jsonb not null default '[]' check (jsonb_typeof(camps) = 'array' and jsonb_array_length(camps) <= 30),
  catalog_key text check (catalog_key is null or catalog_key ~ '^[a-z0-9_-]{1,80}$'),
  mode_id text check (mode_id is null or mode_id ~ '^[a-z0-9_]{1,60}$'),
  visibility text not null default 'public' check (visibility in ('public', 'equipe')),
  published boolean not null default false,
  archived boolean not null default false,
  position double precision not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists docs_spaces_family_idx on public.docs_spaces (family) where family <> '';
create index if not exists docs_spaces_catalog_idx on public.docs_spaces (catalog_key) where catalog_key is not null;

-- ───────────── Pages ─────────────
create table if not exists public.docs_pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.docs_spaces (id),
  parent_id uuid references public.docs_pages (id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  title text not null check (length(btrim(title)) between 1 and 160),
  icon text not null default '' check (length(icon) <= 400),
  kind text not null default 'page' check (kind in ('page', 'group', 'link')),
  link_url text check (link_url is null or (link_url ~* '^https?://[^[:space:]]+$' and length(link_url) <= 600)),
  description text not null default '' check (length(description) <= 300),
  content text not null default '' check (length(content) <= 400000),
  roles jsonb not null default '[]' check (jsonb_typeof(roles) = 'array'),
  visibility text not null default 'public' check (visibility in ('public', 'equipe')),
  hidden boolean not null default false,
  archived boolean not null default false,
  position double precision not null default 0,
  revision integer not null default 0,
  published_at timestamptz,
  search tsvector,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, slug)
);
create index if not exists docs_pages_tree_idx on public.docs_pages (space_id, parent_id, position);
create index if not exists docs_pages_search_idx on public.docs_pages using gin (search);
create index if not exists docs_pages_title_trgm_idx on public.docs_pages using gin (title extensions.gin_trgm_ops);

-- ───────────── Brouillons ─────────────
-- Un brouillon « vide » (content null) signifie : pas de brouillon en cours.
create table if not exists public.docs_drafts (
  page_id uuid primary key references public.docs_pages (id),
  title text,
  description text,
  icon text,
  content text check (content is null or length(content) <= 400000),
  base_revision integer not null default 0,
  author uuid,
  author_label text not null default '',
  source text not null default 'site' check (source in ('site', 'claude', 'git')),
  note text not null default '' check (length(note) <= 500),
  updated_at timestamptz not null default now()
);

-- ───────────── Historique ─────────────
create table if not exists public.docs_revisions (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.docs_pages (id),
  revision integer not null,
  title text not null,
  description text not null default '',
  icon text not null default '',
  content text not null,
  author uuid,
  author_label text not null default '',
  source text not null default 'site' check (source in ('site', 'claude', 'git', 'restauration')),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (page_id, revision)
);
create index if not exists docs_revisions_recent_idx on public.docs_revisions (created_at desc);

-- ───────────── Statistiques ─────────────
create table if not exists public.docs_stats (
  page_id uuid not null references public.docs_pages (id),
  day date not null default ((now() at time zone 'Europe/Paris')::date),
  views integer not null default 0,
  up integer not null default 0,
  down integer not null default 0,
  primary key (page_id, day)
);

-- ───────────── Règles internes ─────────────

-- Rôles tirés des cartes « :::role » d'une page (même lecture que le site, src/lib/markdown.ts).
-- :::role Itachi Uchiha {camp="Akatsuki" tete="Itachi"}   ou   :::role[Itachi]{camp="Akatsuki"}
create or replace function public.docs_extract_roles(p_content text) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare
  line text;
  m text[];
  info text;
  attrs text;
  lbl text;
  nm text;
  out jsonb := '[]';
  n integer := 0;
  want_summary boolean := false;
  anchors text[] := '{}';
  a text;
  k integer;
begin
  for line in select regexp_split_to_table(coalesce(p_content, ''), E'\n') loop
    m := regexp_match(line, '^\s*:{3,}\s*role(\s.*|\[.*|\{.*)?$', 'i');
    if m is not null then
      info := btrim(coalesce(m[1], ''));
      attrs := coalesce(substring(info from '\{([^}]*)\}\s*$'), '');
      lbl := btrim(regexp_replace(info, '\{[^}]*\}\s*$', ''));
      lbl := btrim(regexp_replace(lbl, '^\[(.*)\]$', '\1'));
      nm := btrim(coalesce(nullif(substring(attrs from '(?:nom|name)\s*=\s*"([^"]*)"'), ''), lbl));
      want_summary := false;
      continue when nm = '';
      n := n + 1;
      exit when n > 300;
      a := 'role-' || public.docs_slugify(nm);
      k := 2;
      while a = any (anchors) loop
        a := 'role-' || public.docs_slugify(nm) || '-' || k;
        k := k + 1;
      end loop;
      anchors := anchors || a;
      out := out || jsonb_build_object(
        'name', left(nm, 80),
        'camp', left(btrim(coalesce(substring(attrs from 'camp\s*=\s*"([^"]*)"'), '')), 60),
        'head', left(btrim(coalesce(substring(attrs from '(?:tete|tête|head|skin)\s*=\s*"([^"]*)"'), '')), 120),
        'anchor', a,
        'summary', '');
      want_summary := true;
    elsif want_summary and btrim(line) <> '' then
      want_summary := false;
      if line !~ '^\s*(:{2,}|!\[|\||#)' then
        out := jsonb_set(out, array[(jsonb_array_length(out) - 1)::text, 'summary'],
          to_jsonb(left(btrim(regexp_replace(public.docs_plain(line), '\s+', ' ', 'g')), 220)));
      end if;
    end if;
  end loop;
  return out;
end $$;

create or replace function public.docs_pages_before() returns trigger
language plpgsql set search_path = public, extensions as $$
declare
  role_names text;
begin
  if tg_op = 'INSERT' or new.content is distinct from old.content then
    new.roles := public.docs_extract_roles(new.content);
  end if;
  if tg_op = 'INSERT' or new.content is distinct from old.content or new.title is distinct from old.title
     or new.description is distinct from old.description then
    select coalesce(string_agg((r ->> 'name') || ' ' || (r ->> 'camp'), ' '), '') into role_names
    from jsonb_array_elements(new.roles) r;
    new.search :=
      setweight(to_tsvector('public.docs_fr', coalesce(new.title, '')), 'A') ||
      setweight(to_tsvector('public.docs_fr', role_names), 'A') ||
      setweight(to_tsvector('public.docs_fr', coalesce(new.description, '')), 'B') ||
      setweight(to_tsvector('public.docs_fr', public.docs_plain(left(new.content, 200000))), 'C');
  end if;
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Une page ne peut pas être sa propre parente.';
    end if;
    if not exists (select 1 from public.docs_pages p where p.id = new.parent_id and p.space_id = new.space_id) then
      raise exception 'La page parente doit être dans le même espace.';
    end if;
    if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id and exists (
      with recursive up as (
        select p.id, p.parent_id from public.docs_pages p where p.id = new.parent_id
        union all
        select p.id, p.parent_id from public.docs_pages p join up on p.id = up.parent_id
      ) select 1 from up where up.id = new.id
    ) then
      raise exception 'Impossible de ranger une page dans une de ses sous-pages.';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.space_id is distinct from old.space_id then
    raise exception 'Une page ne change pas d''espace.';
  end if;
  if new.kind = 'link' and new.link_url is null then
    raise exception 'Un lien du menu a besoin d''une adresse.';
  end if;
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;
    new.updated_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'docs_pages_before' and tgrelid = 'public.docs_pages'::regclass) then
    create trigger docs_pages_before before insert or update on public.docs_pages
  for each row execute function public.docs_pages_before();
  end if;
end $$;

-- Mettre une page à la corbeille y met aussi ses sous-pages (et l'inverse pour la sortir).
create or replace function public.docs_pages_after() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.archived is distinct from old.archived then
    update public.docs_pages set archived = new.archived where parent_id = new.id and archived is distinct from new.archived;
  end if;
  return null;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'docs_pages_after' and tgrelid = 'public.docs_pages'::regclass) then
    create trigger docs_pages_after after update of archived on public.docs_pages
  for each row execute function public.docs_pages_after();
  end if;
end $$;

create or replace function public.docs_spaces_before() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Mettre en ligne, rendre public ou mettre à la corbeille un espace : admins seulement.
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and (new.published or new.archived) then
      raise exception 'Seul un admin peut mettre un espace en ligne.';
    end if;
    if tg_op = 'UPDATE' and (new.published is distinct from old.published or new.archived is distinct from old.archived
        or new.visibility is distinct from old.visibility) then
      raise exception 'Seul un admin peut mettre en ligne, rendre public ou retirer un espace.';
    end if;
  end if;
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;
    new.updated_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'docs_spaces_before' and tgrelid = 'public.docs_spaces'::regclass) then
    create trigger docs_spaces_before before insert or update on public.docs_spaces
  for each row execute function public.docs_spaces_before();
  end if;
end $$;

-- Droits de la personne connectée, appelables aussi par un visiteur (qui n'est jamais membre).
create or replace function public.docs_member() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.is_member();
$$;

create or replace function public.docs_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.is_admin();
$$;

-- Un espace visible de tous (publié, public, pas à la corbeille).
create or replace function public.docs_space_public(p_space uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.docs_spaces s
                 where s.id = p_space and s.published and not s.archived and s.visibility = 'public');
$$;

-- Une page visible de tous.
create or replace function public.docs_page_public(p_page uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.docs_pages p
                 where p.id = p_page and p.published_at is not null and not p.archived and p.visibility = 'public'
                   and public.docs_space_public(p.space_id));
$$;

-- ───────────── Sécurité (RLS) ─────────────
alter table public.docs_settings enable row level security;
alter table public.docs_spaces enable row level security;
alter table public.docs_pages enable row level security;
alter table public.docs_drafts enable row level security;
alter table public.docs_revisions enable row level security;
alter table public.docs_stats enable row level security;

-- Personne n'écrit directement hors des colonnes prévues ; tout le reste passe par les fonctions ci-dessous.
revoke all on public.docs_settings, public.docs_spaces, public.docs_pages, public.docs_drafts,
  public.docs_revisions, public.docs_stats from anon, authenticated;

grant select on public.docs_settings to anon, authenticated;
grant update (site_url, link_catalog) on public.docs_settings to authenticated;

grant select on public.docs_spaces to anon, authenticated;
grant insert (slug, title, tagline, kind, icon, color, cover_url, family, version_label, universe, credits, origin_url,
  mc_version, command, players, camps, catalog_key, mode_id, visibility, published, position)
  on public.docs_spaces to authenticated;
grant update (slug, title, tagline, kind, icon, color, cover_url, family, version_label, universe, credits, origin_url,
  mc_version, command, players, camps, catalog_key, mode_id, visibility, published, archived, position)
  on public.docs_spaces to authenticated;

grant select (id, space_id, parent_id, slug, title, icon, kind, link_url, description, content, roles, visibility, hidden,
  archived, position, revision, published_at, created_at, updated_at) on public.docs_pages to anon;
grant select on public.docs_pages to authenticated;
grant update (parent_id, slug, title, icon, kind, link_url, visibility, hidden, archived, position)
  on public.docs_pages to authenticated;

grant select on public.docs_drafts, public.docs_revisions, public.docs_stats to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'docs_settings' and policyname = 'docs_settings_read') then
    create policy docs_settings_read on public.docs_settings for select to anon, authenticated using (true);
    create policy docs_settings_admin on public.docs_settings for update to authenticated
      using ((select public.docs_admin())) with check ((select public.docs_admin()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'docs_spaces' and policyname = 'docs_spaces_read') then
    create policy docs_spaces_read on public.docs_spaces for select to anon, authenticated
      using ((published and not archived and visibility = 'public') or (select public.docs_member()));
    create policy docs_spaces_add on public.docs_spaces for insert to authenticated with check ((select public.docs_member()));
    create policy docs_spaces_edit on public.docs_spaces for update to authenticated
      using ((select public.docs_member())) with check ((select public.docs_member()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'docs_pages' and policyname = 'docs_pages_read') then
    create policy docs_pages_read on public.docs_pages for select to anon, authenticated
      using ((published_at is not null and not archived and visibility = 'public' and public.docs_space_public(space_id))
             or (select public.docs_member()));
    create policy docs_pages_edit on public.docs_pages for update to authenticated
      using ((select public.docs_member())) with check ((select public.docs_member()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'docs_drafts' and policyname = 'docs_drafts_read') then
    create policy docs_drafts_read on public.docs_drafts for select to authenticated using ((select public.docs_member()));
    create policy docs_revisions_read on public.docs_revisions for select to authenticated using ((select public.docs_member()));
    create policy docs_stats_read on public.docs_stats for select to authenticated using ((select public.docs_member()));
  end if;
end $$;

-- ───────────── Fonctions de l'éditeur (membres) ─────────────

create or replace function public.docs_me_label() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(btrim(pseudo), '') from public.profiles where id = auth.uid()), 'Équipe Tsuki');
$$;

-- Slug libre dans un espace : « akatsuki », sinon « akatsuki-2 », « akatsuki-3 »…
create or replace function public.docs_free_slug(p_space uuid, p_wanted text, p_except uuid default null) returns text
language plpgsql stable set search_path = public as $$
declare
  base text := nullif(public.docs_slugify(p_wanted), '');
  s text;
  k integer := 2;
begin
  base := coalesce(base, 'page');
  s := base;
  while exists (select 1 from public.docs_pages where space_id = p_space and slug = s and id is distinct from p_except) loop
    s := left(base, 55) || '-' || k;
    k := k + 1;
  end loop;
  return s;
end $$;

-- Nouvelle page (ou groupe de menu, ou lien) à la fin de ses sœurs. Renvoie son identifiant.
create or replace function public.docs_create_page(p_space uuid, p_parent uuid, p_title text, p_kind text default 'page',
  p_link_url text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_pos double precision;
begin
  if not public.is_member() then
    raise exception 'Réservé à l''équipe Tsuki.';
  end if;
  if not exists (select 1 from public.docs_spaces where id = p_space) then
    raise exception 'Espace introuvable.';
  end if;
  select coalesce(max(position), 0) + 1 into v_pos from public.docs_pages
  where space_id = p_space and parent_id is not distinct from p_parent;
  insert into public.docs_pages (space_id, parent_id, slug, title, kind, link_url, position, published_at)
  values (p_space, p_parent, public.docs_free_slug(p_space, p_title), left(btrim(coalesce(nullif(p_title, ''), 'Nouvelle page')), 160),
          coalesce(p_kind, 'page'), p_link_url, v_pos, case when coalesce(p_kind, 'page') <> 'page' then now() end)
  returning id into v_id;
  return v_id;
end $$;

-- Enregistre le brouillon d'une page (appelé tout seul pendant la frappe).
create or replace function public.docs_save_draft(p_page uuid, p_title text, p_description text, p_icon text, p_content text,
  p_base integer) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz := now();
begin
  if not public.is_member() then
    raise exception 'Réservé à l''équipe Tsuki.';
  end if;
  if not exists (select 1 from public.docs_pages where id = p_page) then
    raise exception 'Page introuvable.';
  end if;
  insert into public.docs_drafts (page_id, title, description, icon, content, base_revision, author, author_label, source, note, updated_at)
  values (p_page, left(p_title, 160), left(coalesce(p_description, ''), 300), left(coalesce(p_icon, ''), 400),
          p_content, coalesce(p_base, 0), auth.uid(), public.docs_me_label(), 'site', '', v_at)
  on conflict (page_id) do update set
    title = excluded.title, description = excluded.description, icon = excluded.icon, content = excluded.content,
    base_revision = case when public.docs_drafts.content is null then excluded.base_revision else public.docs_drafts.base_revision end,
    author = excluded.author, author_label = excluded.author_label, source = 'site', updated_at = v_at;
  return v_at;
end $$;

-- Abandonne le brouillon d'une page.
create or replace function public.docs_discard_draft(p_page uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'Réservé à l''équipe Tsuki.';
  end if;
  update public.docs_drafts set content = null, note = '', updated_at = now() where page_id = p_page;
end $$;

-- Cœur de la publication (interne) : nouvelle révision, historique, brouillon vidé, journal de Tsuki.
create or replace function public.docs_write_revision(p_page uuid, p_title text, p_description text, p_icon text, p_content text,
  p_note text, p_author uuid, p_label text, p_source text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  r public.docs_pages;
  v_rev integer;
  v_space public.docs_spaces;
begin
  select * into r from public.docs_pages where id = p_page for update;
  if not found then
    raise exception 'Page introuvable.';
  end if;
  if length(coalesce(p_content, '')) > 400000 then
    raise exception 'Page trop longue (400 000 caractères au plus).';
  end if;
  v_rev := r.revision + 1;
  update public.docs_pages set
    title = left(btrim(coalesce(nullif(btrim(p_title), ''), r.title)), 160),
    description = left(btrim(coalesce(p_description, r.description)), 300),
    icon = left(coalesce(p_icon, r.icon), 400),
    content = coalesce(p_content, ''),
    revision = v_rev,
    published_at = coalesce(r.published_at, now())
  where id = p_page;
  insert into public.docs_revisions (page_id, revision, title, description, icon, content, author, author_label, source, note)
  select id, v_rev, title, description, icon, content, p_author, coalesce(p_label, ''), p_source, left(btrim(coalesce(p_note, '')), 500)
  from public.docs_pages where id = p_page;
  update public.docs_drafts set content = null, note = '', updated_at = now() where page_id = p_page;

  select * into v_space from public.docs_spaces where id = r.space_id;
  insert into public.activity (actor_id, actor_label, action, entity, entity_id, label, section)
  values (p_author, coalesce(p_label, ''), case when v_rev = 1 then 'cree' else 'modifie' end, 'docs_pages', p_page,
          'la doc ' || v_space.title || ' › ' || coalesce(nullif(btrim(p_title), ''), r.title), 'uhc');
  return v_rev;
end $$;

-- Publie une page. p_base = révision sur laquelle on a travaillé : si quelqu'un a publié entre-temps,
-- refus « conflit:<révision actuelle> », sauf p_force (l'éditeur montre les différences avant).
create or replace function public.docs_publish(p_page uuid, p_title text, p_description text, p_icon text, p_content text,
  p_note text, p_base integer, p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_current integer;
begin
  if not public.is_member() then
    raise exception 'Réservé à l''équipe Tsuki.';
  end if;
  select revision into v_current from public.docs_pages where id = p_page for update;
  if not found then
    raise exception 'Page introuvable.';
  end if;
  if v_current <> coalesce(p_base, 0) and not coalesce(p_force, false) then
    raise exception 'conflit:%', v_current;
  end if;
  return public.docs_write_revision(p_page, p_title, p_description, p_icon, p_content, p_note, auth.uid(), public.docs_me_label(), 'site');
end $$;

-- Remet en ligne une ancienne version (elle devient une nouvelle révision : rien n'est perdu).
create or replace function public.docs_restore(p_page uuid, p_revision integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  old public.docs_revisions;
begin
  if not public.is_member() then
    raise exception 'Réservé à l''équipe Tsuki.';
  end if;
  select * into old from public.docs_revisions where page_id = p_page and revision = p_revision;
  if not found then
    raise exception 'Version introuvable.';
  end if;
  return public.docs_write_revision(p_page, old.title, old.description, old.icon, old.content,
    'Retour à la version ' || p_revision, auth.uid(), public.docs_me_label(), 'restauration');
end $$;

-- ───────────── Fonctions publiques (lecture) ─────────────

-- Recherche plein texte (et rôles). Chacun ne trouve que ce qu'il peut lire : un visiteur, les pages publiques ;
-- un membre, tout (sauf la corbeille).
create or replace function public.docs_search(q text, p_space uuid default null, p_limit integer default 20)
returns table (kind text, page_id uuid, space_id uuid, space_slug text, space_title text, space_icon text, page_slug text,
  title text, icon text, anchor text, camp text, snippet text, score real)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  member boolean := public.docs_member();
  words text[];
  tq tsquery;
  uq text := lower(extensions.unaccent(btrim(coalesce(q, ''))));
begin
  if length(uq) < 2 then
    return;
  end if;
  select array_agg(w) into words
  from (select regexp_replace(w, '[^[:alnum:]]', '', 'g') w from regexp_split_to_table(uq, '\s+') w) x
  where length(w) > 0 limit 8;
  if words is null then
    return;
  end if;
  tq := to_tsquery('public.docs_fr', array_to_string(array(select quote_literal(w) || ':*' from unnest(words) w), ' & '));
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  with pages as (
    select p.*, s.slug s_slug, s.title s_title, s.icon s_icon,
           ts_rank(p.search, tq) + extensions.word_similarity(uq, lower(extensions.unaccent(p.title))) * 0.6 sc
    from public.docs_pages p join public.docs_spaces s on s.id = p.space_id
    where not p.archived and not s.archived and p.kind = 'page' and p.published_at is not null
      and (member or (p.visibility = 'public' and s.published and s.visibility = 'public'))
      and (p_space is null or p.space_id = p_space)
      and (p.search @@ tq or extensions.word_similarity(uq, lower(extensions.unaccent(p.title))) > 0.45)
    order by sc desc limit p_limit
  ), roles as (
    select p.id pid, p.space_id sid, s.slug s_slug, s.title s_title, s.icon s_icon, p.slug p_slug, r,
           extensions.word_similarity(uq, lower(extensions.unaccent(r ->> 'name'))) sc
    from public.docs_pages p join public.docs_spaces s on s.id = p.space_id, jsonb_array_elements(p.roles) r
    where not p.archived and not s.archived and p.published_at is not null and jsonb_array_length(p.roles) > 0
      and (member or (p.visibility = 'public' and s.published and s.visibility = 'public'))
      and (p_space is null or p.space_id = p_space)
      and extensions.word_similarity(uq, lower(extensions.unaccent(r ->> 'name'))) > 0.5
    order by sc desc limit 8
  )
  select 'role'::text, roles.pid, roles.sid, roles.s_slug, roles.s_title, roles.s_icon, roles.p_slug,
         roles.r ->> 'name', roles.r ->> 'head', roles.r ->> 'anchor', roles.r ->> 'camp', roles.r ->> 'summary', (roles.sc + 1)::real
  from roles
  union all
  select 'page'::text, pages.id, pages.space_id, pages.s_slug, pages.s_title, pages.s_icon, pages.slug,
         pages.title, pages.icon, null::text, null::text,
         ts_headline('public.docs_fr', public.docs_plain(left(pages.content, 60000)), tq,
           'StartSel=«, StopSel=», MaxWords=26, MinWords=12, MaxFragments=1, ShortWord=2'),
         pages.sc::real
  from pages
  order by 13 desc;
end $$;

-- Statut des modes (Fait, En cours…) lu dans le tableau de Tsuki, pour les espaces visibles.
create or replace function public.docs_space_status() returns table (space_id uuid, status text, catalog_name text, catalog_version text)
language sql stable security definer set search_path = public as $$
  select s.id, c.status, c.name, c.version
  from public.docs_spaces s join public.catalog c on c.seed_key = s.catalog_key
  where (s.published and not s.archived and s.visibility = 'public') or public.docs_member();
$$;

-- Journal des nouveautés : publications avec une note, des pages que l'appelant peut lire.
create or replace function public.docs_changelog(p_limit integer default 40)
returns table (space_slug text, space_title text, space_icon text, page_slug text, page_title text, revision integer,
  note text, author_label text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.slug, s.title, s.icon, p.slug, r.title, r.revision, r.note,
         case when public.docs_member() then r.author_label else '' end, r.created_at
  from public.docs_revisions r
  join public.docs_pages p on p.id = r.page_id
  join public.docs_spaces s on s.id = p.space_id
  where btrim(r.note) <> '' and not p.archived and not s.archived
    and (public.docs_page_public(p.id) or public.docs_member())
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 200);
$$;

-- Une vue de page (appelée une fois par visite par le site).
create or replace function public.docs_hit(p_page uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.docs_page_public(p_page) then
    return;
  end if;
  insert into public.docs_stats (page_id, views) values (p_page, 1)
  on conflict (page_id, day) do update set views = least(public.docs_stats.views + 1, 1000000);
end $$;

-- « Cette page t'a aidé ? »
create or replace function public.docs_vote(p_page uuid, p_up boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.docs_page_public(p_page) then
    return;
  end if;
  insert into public.docs_stats (page_id, up, down) values (p_page, case when p_up then 1 else 0 end, case when p_up then 0 else 1 end)
  on conflict (page_id, day) do update set
    up = least(public.docs_stats.up + case when p_up then 1 else 0 end, 1000000),
    down = least(public.docs_stats.down + case when p_up then 0 else 1 end, 1000000);
end $$;

-- Dernière modification visible (le site s'en sert pour savoir s'il doit se reconstruire).
create or replace function public.docs_last_change() returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(updated_at) from public.docs_spaces where published and not archived and visibility = 'public'),
    (select max(p.updated_at) from public.docs_pages p where public.docs_space_public(p.space_id)));
$$;

-- ───────────── Lien avec le tableau des modes de Tsuki ─────────────
-- Quand le réglage link_catalog est actif, la coche « Doc » d'un mode ouvre sa page Tsuki Docs.
-- L'ancien lien (doc d'origine) est gardé dans le champ « doc » de la ligne et dans origin_url de l'espace.
create or replace function public.docs_link_catalog(p_space uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.docs_spaces;
  cfg public.docs_settings;
  url text;
  c public.catalog;
begin
  select * into cfg from public.docs_settings where id = 1;
  select * into s from public.docs_spaces where id = p_space;
  if not found or not cfg.link_catalog or s.catalog_key is null or not s.published or s.archived or s.visibility <> 'public' then
    return;
  end if;
  url := cfg.site_url || '/' || s.slug || '/';
  select * into c from public.catalog where seed_key = s.catalog_key;
  if not found or c.doc_url is not distinct from url then
    return;
  end if;
  if c.doc_url is not null and position(c.doc_url in coalesce(c.doc, '')) = 0 then
    update public.catalog set doc = concat_ws(E'\n', nullif(btrim(coalesce(doc, '')), ''), c.doc_url) where id = c.id;
  end if;
  if c.doc_url is not null and s.origin_url is null and position(cfg.site_url in c.doc_url) <> 1 then
    update public.docs_spaces set origin_url = c.doc_url where id = s.id;
  end if;
  update public.catalog set doc_url = url where id = c.id;
end $$;

create or replace function public.docs_spaces_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.docs_link_catalog(new.id);
  return null;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'docs_spaces_after' and tgrelid = 'public.docs_spaces'::regclass) then
    create trigger docs_spaces_after after insert or update of published, visibility, archived, catalog_key, slug on public.docs_spaces
  for each row execute function public.docs_spaces_after();
  end if;
end $$;

-- Relie tous les espaces d'un coup (admins, une fois le site en ligne).
create or replace function public.docs_link_all() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s record;
  n integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Réservé aux admins.';
  end if;
  for s in select id from public.docs_spaces where catalog_key is not null loop
    perform public.docs_link_catalog(s.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────── Droits d'exécution ─────────────
revoke execute on function public.docs_pages_before(), public.docs_pages_after(), public.docs_spaces_before(),
  public.docs_spaces_after(), public.docs_write_revision(uuid, text, text, text, text, text, uuid, text, text),
  public.docs_link_catalog(uuid) from public, anon, authenticated;
revoke execute on function public.docs_create_page(uuid, uuid, text, text, text), public.docs_save_draft(uuid, text, text, text, text, integer),
  public.docs_discard_draft(uuid), public.docs_publish(uuid, text, text, text, text, text, integer, boolean),
  public.docs_restore(uuid, integer), public.docs_link_all(), public.docs_me_label() from public, anon;
grant execute on function public.docs_create_page(uuid, uuid, text, text, text), public.docs_save_draft(uuid, text, text, text, text, integer),
  public.docs_discard_draft(uuid), public.docs_publish(uuid, text, text, text, text, text, integer, boolean),
  public.docs_restore(uuid, integer), public.docs_link_all(), public.docs_me_label() to authenticated;
grant execute on function public.docs_search(text, uuid, integer), public.docs_space_status(), public.docs_changelog(integer),
  public.docs_hit(uuid), public.docs_vote(uuid, boolean), public.docs_last_change(), public.docs_slugify(text),
  public.docs_plain(text), public.docs_extract_roles(text), public.docs_space_public(uuid), public.docs_page_public(uuid),
  public.docs_free_slug(uuid, text, uuid), public.docs_member(), public.docs_admin() to anon, authenticated;

-- ───────────── Images ─────────────
-- Seau public « docs » : lecture libre, ajout par les membres, images de 5 Mo au plus (pas de SVG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('docs', 'docs', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'docs_images_add') then
    create policy docs_images_add on storage.objects for insert to authenticated
      with check (bucket_id = 'docs' and (select public.docs_member()));
  end if;
end $$;
