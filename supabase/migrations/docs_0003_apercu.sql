-- Almanach · aperçu des espaces pour l'accueil (nombre de pages et de rôles, dernière mise à jour)
-- et slug sans tiret final quand le titre dépasse 60 caractères.

create or replace function public.docs_slugify(t text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select btrim(left(btrim(regexp_replace(
    replace(replace(replace(lower(extensions.unaccent(coalesce(t, ''))), 'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'),
    '[^a-z0-9]+', '-', 'g'), '-'), 60), '-')
$$;

-- Pour chaque espace que l'appelant peut voir : pages publiées, rôles, dernière mise à jour.
create or replace function public.docs_overview()
returns table (space_id uuid, pages integer, roles integer, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.space_id,
         count(*) filter (where p.kind = 'page')::integer,
         coalesce(sum(jsonb_array_length(p.roles)), 0)::integer,
         max(p.updated_at)
  from public.docs_pages p
  where not p.archived and p.published_at is not null
    and ((p.visibility = 'public' and public.docs_space_public(p.space_id)) or public.docs_member())
  group by p.space_id;
$$;

grant execute on function public.docs_overview() to anon, authenticated;
