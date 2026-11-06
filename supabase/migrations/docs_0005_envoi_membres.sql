-- Almanach · envoi de pages par le Claude de chaque membre (dépôt GitHub public ORA-KUN/TsukiAlmanach).
--
-- Deux verrous :
-- · GitHub : seuls les collaborateurs du dépôt (ajoutés par Jules) peuvent pousser une branche, et donc lancer
--   l'action « Contenu » qui obtient le jeton OIDC ; un fork ou une demande de fusion n'obtient jamais ce jeton ;
-- · Tsuki : la fonction docs-sync n'accepte l'envoi que si le compte GitHub qui a poussé est relié ici à un membre
--   de Tsuki (compte validé et invitation toujours présente). Retirer l'invitation coupe aussi l'envoi.
-- Chaque membre relie lui-même son compte GitHub dans l'espace équipe (onglet Claude).
-- Volontairement sans aucune instruction destructive : délier = vider le champ.

create table if not exists public.docs_git_authors (
  member_id uuid primary key,
  github_login text unique check (github_login is null or github_login ~ '^[a-z0-9](-?[a-z0-9]){0,38}$'),
  updated_at timestamptz not null default now()
);

alter table public.docs_git_authors enable row level security;
revoke all on public.docs_git_authors from anon, authenticated;
grant select on public.docs_git_authors to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'docs_git_authors' and policyname = 'docs_git_authors_lecture') then
    create policy docs_git_authors_lecture on public.docs_git_authors for select to authenticated using (public.docs_member());
  end if;
end $$;

-- Relier (ou délier avec un texte vide) son propre compte GitHub. Accepte « pseudo », « @pseudo » ou l'adresse du profil.
create or replace function public.docs_set_github(p_login text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v text := lower(btrim(coalesce(p_login, '')));
begin
  if not public.docs_member() then
    raise exception 'Réservé aux membres de l''équipe Tsuki.';
  end if;
  v := regexp_replace(v, '^(https?://)?(www\.)?github\.com/', '');
  v := regexp_replace(v, '^@', '');
  v := regexp_replace(v, '/.*$', '');
  if v = '' then
    v := null;
  elsif v !~ '^[a-z0-9](-?[a-z0-9]){0,38}$' then
    raise exception 'Pseudo GitHub invalide : lettres, chiffres et tirets seulement.';
  end if;
  if v is not null and exists (select 1 from public.docs_git_authors where github_login = v and member_id <> auth.uid()) then
    raise exception 'Ce compte GitHub est déjà relié à un autre membre.';
  end if;
  insert into public.docs_git_authors (member_id, github_login, updated_at)
  values (auth.uid(), v, now())
  on conflict (member_id) do update set github_login = excluded.github_login, updated_at = now();
  return v;
end $$;

revoke execute on function public.docs_set_github(text) from public, anon;
grant execute on function public.docs_set_github(text) to authenticated;

-- Pour la fonction docs-sync (clé de service) : le membre relié à ce compte GitHub, s'il fait toujours partie de l'équipe.
create or replace function public.docs_git_author(p_login text)
returns table (member_id uuid, pseudo text)
language sql stable security definer set search_path = public as $$
  select p.id, p.pseudo
  from public.docs_git_authors g
  join public.profiles p on p.id = g.member_id
  join auth.users u on u.id = p.id
  join public.invitations i on i.email = lower(u.email)
  where g.github_login = lower(btrim(coalesce(p_login, ''))) and p.approved
  limit 1;
$$;

revoke execute on function public.docs_git_author(text) from public, anon, authenticated;
grant execute on function public.docs_git_author(text) to service_role;
