-- Almanach · onglet « Membres » de l'espace équipe, réservé aux admins (demande de Jules, 06/11).
-- Un admin y voit tous les comptes de l'équipe et peut corriger une adresse e-mail, donner un mot de passe provisoire
-- (fonction admin_set_password de Tsuki), changer le rôle et relier ou délier le compte GitHub d'un membre.
--
-- Mêmes garde-fous que l'application Tsuki : un admin ne change ni l'e-mail ni le mot de passe d'un autre admin
-- (il lui retire d'abord le rôle admin) et personne ne retire son propre rôle admin. Supprimer un compte ou une invitation
-- reste dans Tsuki (Équipe › Invitations).
--
-- Correctif : un compte GitHub resté relié à un ancien compte (supprimé, ou dont l'invitation a été retirée) est libéré
-- tout seul quand un membre actuel le relie. Volontairement sans aucune instruction destructive.

-- Ce compte fait-il toujours partie de l'équipe ? (profil validé et invitation présente, comme is_member)
create or replace function public.docs_is_member_id(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    join public.invitations i on i.email = lower(u.email)
    where p.id = p_id and p.approved
  );
$$;

revoke execute on function public.docs_is_member_id(uuid) from public, anon, authenticated;

-- Relie (ou délie avec un texte vide) un compte GitHub à un membre. Usage interne.
create or replace function public.docs_link_github(p_member uuid, p_login text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v text := lower(btrim(coalesce(p_login, '')));
begin
  v := regexp_replace(v, '^(https?://)?(www\.)?github\.com/', '');
  v := regexp_replace(v, '^@', '');
  v := regexp_replace(v, '/.*$', '');
  if v = '' then
    v := null;
  elsif v !~ '^[a-z0-9](-?[a-z0-9]){0,38}$' then
    raise exception 'Pseudo GitHub invalide : lettres, chiffres et tirets seulement.';
  end if;
  if v is not null then
    -- Compte resté sur un ancien compte qui n'est plus dans l'équipe : on le libère.
    update public.docs_git_authors g set github_login = null, updated_at = now()
    where g.github_login = v and g.member_id <> p_member and not public.docs_is_member_id(g.member_id);
    if exists (select 1 from public.docs_git_authors g where g.github_login = v and g.member_id <> p_member) then
      raise exception 'Ce compte GitHub est déjà relié à un autre membre.';
    end if;
  end if;
  insert into public.docs_git_authors (member_id, github_login, updated_at)
  values (p_member, v, now())
  on conflict (member_id) do update set github_login = excluded.github_login, updated_at = now();
  return v;
end $$;

revoke execute on function public.docs_link_github(uuid, text) from public, anon, authenticated;

-- Son propre compte GitHub (onglet Claude).
create or replace function public.docs_set_github(p_login text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.docs_member() then
    raise exception 'Réservé aux membres de l''équipe Tsuki.';
  end if;
  return public.docs_link_github(auth.uid(), p_login);
end $$;

revoke execute on function public.docs_set_github(text) from public, anon;
grant execute on function public.docs_set_github(text) to authenticated;

-- Liste des comptes de l'équipe, pour les admins.
create or replace function public.docs_admin_members()
returns table (id uuid, pseudo text, mc_name text, email text, role text, member boolean, github_login text,
               last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.docs_admin() then
    raise exception 'Réservé aux admins.';
  end if;
  return query
    select p.id, p.pseudo, p.mc_name, u.email::text, p.role, public.docs_is_member_id(p.id), g.github_login,
           u.last_sign_in_at, u.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.docs_git_authors g on g.member_id = p.id
    order by (p.role = 'admin') desc, lower(p.pseudo);
end $$;

revoke execute on function public.docs_admin_members() from public, anon;
grant execute on function public.docs_admin_members() to authenticated;

-- Corriger l'adresse e-mail d'un compte (connexion + invitation, pour qu'il reste membre).
create or replace function public.docs_admin_set_email(p_target uuid, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v text := lower(btrim(coalesce(p_email, '')));
  old text;
begin
  if not public.docs_admin() then
    raise exception 'Réservé aux admins.';
  end if;
  if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 254 then
    raise exception 'Adresse e-mail invalide.';
  end if;
  if p_target <> auth.uid() and exists (select 1 from public.profiles where id = p_target and role = 'admin') then
    raise exception 'Impossible de changer l''adresse d''un autre admin : retire-lui d''abord le rôle admin.';
  end if;
  select lower(u.email) into old from auth.users u where u.id = p_target;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if v = old then
    return v;
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v and u.id <> p_target) then
    raise exception 'Cette adresse est déjà utilisée par un autre compte.';
  end if;
  if exists (select 1 from public.invitations where email = v) then
    raise exception 'Cette adresse a déjà sa propre invitation : retire-la d''abord dans Tsuki (Équipe › Invitations).';
  end if;
  update auth.users set email = v, updated_at = now() where id = p_target;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v)), updated_at = now()
  where user_id = p_target and provider = 'email';
  update public.invitations set email = v where email = old;
  return v;
end $$;

revoke execute on function public.docs_admin_set_email(uuid, text) from public, anon;
grant execute on function public.docs_admin_set_email(uuid, text) to authenticated;

-- Changer le rôle d'un compte (admin ou membre).
create or replace function public.docs_admin_set_role(p_target uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.docs_admin() then
    raise exception 'Réservé aux admins.';
  end if;
  if p_role is null or p_role not in ('admin', 'membre') then
    raise exception 'Rôle inconnu.';
  end if;
  if p_target = auth.uid() and p_role <> 'admin' then
    raise exception 'Tu ne peux pas retirer ton propre rôle admin.';
  end if;
  update public.profiles set role = p_role where id = p_target;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  return p_role;
end $$;

revoke execute on function public.docs_admin_set_role(uuid, text) from public, anon;
grant execute on function public.docs_admin_set_role(uuid, text) to authenticated;

-- Relier ou délier le compte GitHub d'un membre.
create or replace function public.docs_admin_set_github(p_target uuid, p_login text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.docs_admin() then
    raise exception 'Réservé aux admins.';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'Compte introuvable.';
  end if;
  return public.docs_link_github(p_target, p_login);
end $$;

revoke execute on function public.docs_admin_set_github(uuid, text) from public, anon;
grant execute on function public.docs_admin_set_github(uuid, text) to authenticated;
