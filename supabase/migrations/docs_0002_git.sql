-- Almanach (Tsuki Docs) · synchro depuis GitHub (dossier contenu/ du dépôt public).
--
-- L'action .github/workflows/contenu.yml lit les fichiers Markdown modifiés et les envoie à la fonction
-- « docs-sync » (jeton OIDC de GitHub, aucun secret), qui appelle docs_git_sync() avec la clé de service.
--
-- Règles :
-- · un espace absent est créé (public) ; un espace « Équipe » n'est jamais touché depuis GitHub (dépôt public) ;
-- · une page dont le fichier part de la dernière version (en-tête « revision » = révision en ligne) est publiée,
--   signée « Claude » dans l'historique ;
-- · si la page a été modifiée sur le site depuis, rien n'est écrasé : le texte devient un brouillon
--   « proposé par Claude », à relire et publier dans l'éditeur ; un brouillon en cours sur le site n'est jamais remplacé ;
-- · une page absente des fichiers n'est jamais retirée ; « archived: true » la met à la corbeille.
-- Volontairement sans aucune instruction destructive.

create or replace function public.docs_git_sync(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sp jsonb;
  pg jsonb;
  m jsonb;
  v_space public.docs_spaces;
  v_page public.docs_pages;
  v_draft public.docs_drafts;
  v_slug text;
  v_parent uuid;
  v_id uuid;
  v_label text := left(coalesce(nullif(btrim(p ->> 'author'), ''), 'Claude'), 60);
  v_note text;
  v_title text;
  v_desc text;
  v_icon text;
  v_content text;
  v_base integer;
  report jsonb := jsonb_build_object('espaces_crees', 0, 'pages_creees', 0, 'publiees', 0, 'propositions', 0,
                                     'identiques', 0, 'ignorees', '[]'::jsonb);
  ign jsonb := '[]';
begin
  if p is null or jsonb_typeof(p -> 'spaces') <> 'array' then
    raise exception 'Envoi invalide.';
  end if;

  for sp in select value from jsonb_array_elements(p -> 'spaces') limit 200 loop
    v_slug := sp ->> 'slug';
    continue when v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 60;
    m := coalesce(sp -> 'meta', '{}');

    select * into v_space from public.docs_spaces where slug = v_slug;
    if found and v_space.visibility = 'equipe' then
      ign := ign || jsonb_build_object('espace', v_slug, 'raison', 'espace réservé à l''équipe');
      continue;
    end if;
    if not found then
      insert into public.docs_spaces (slug, title, published)
      values (v_slug, left(coalesce(nullif(btrim(m ->> 'title'), ''), v_slug), 120), coalesce((m ->> 'published')::boolean, true))
      returning * into v_space;
      report := jsonb_set(report, '{espaces_crees}', to_jsonb((report ->> 'espaces_crees')::int + 1));
    end if;

    -- Champs de l'espace présents dans _espace.md (les autres ne bougent pas).
    update public.docs_spaces s set
      title = case when m ? 'title' then left(coalesce(nullif(btrim(m ->> 'title'), ''), s.title), 120) else s.title end,
      tagline = case when m ? 'tagline' then left(coalesce(m ->> 'tagline', ''), 300) else s.tagline end,
      kind = case when m ->> 'kind' in ('mode', 'guide') then m ->> 'kind' else s.kind end,
      icon = case when m ? 'icon' then left(coalesce(m ->> 'icon', ''), 400) else s.icon end,
      color = case when coalesce(m ->> 'color', '') ~ '^#[0-9a-fA-F]{6}$' then m ->> 'color' else s.color end,
      cover_url = case when m ? 'cover_url' then nullif(m ->> 'cover_url', '') else s.cover_url end,
      family = case when m ? 'family' then left(coalesce(m ->> 'family', ''), 80) else s.family end,
      version_label = case when m ? 'version_label' then left(coalesce(m ->> 'version_label', ''), 40) else s.version_label end,
      universe = case when m ? 'universe' then left(coalesce(m ->> 'universe', ''), 80) else s.universe end,
      credits = case when m ? 'credits' then left(coalesce(m ->> 'credits', ''), 1200) else s.credits end,
      origin_url = case when m ? 'origin_url' then nullif(m ->> 'origin_url', '') else s.origin_url end,
      mc_version = case when m ? 'mc_version' then left(coalesce(m ->> 'mc_version', ''), 40) else s.mc_version end,
      command = case when m ? 'command' then left(coalesce(m ->> 'command', ''), 80) else s.command end,
      players = case when m ? 'players' then left(coalesce(m ->> 'players', ''), 40) else s.players end,
      camps = case when jsonb_typeof(m -> 'camps') = 'array' then m -> 'camps' else s.camps end,
      catalog_key = case when m ? 'catalog_key' then nullif(m ->> 'catalog_key', '') else s.catalog_key end,
      mode_id = case when m ? 'mode_id' then nullif(m ->> 'mode_id', '') else s.mode_id end,
      published = case when m ? 'published' then coalesce((m ->> 'published')::boolean, s.published) else s.published end,
      position = case when jsonb_typeof(m -> 'position') = 'number' then (m ->> 'position')::double precision else s.position end
    where s.id = v_space.id;

    if jsonb_typeof(sp -> 'pages') <> 'array' then
      continue;
    end if;

    -- 1) Pages manquantes créées (à la racine pour l'instant).
    for pg in select value from jsonb_array_elements(sp -> 'pages') limit 500 loop
      continue when coalesce(pg ->> 'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(pg ->> 'slug') > 60;
      if not exists (select 1 from public.docs_pages where space_id = v_space.id and slug = pg ->> 'slug') then
        insert into public.docs_pages (space_id, slug, title, kind, link_url, published_at)
        values (v_space.id, pg ->> 'slug', left(coalesce(nullif(btrim(pg ->> 'title'), ''), pg ->> 'slug'), 160),
                case when pg ->> 'kind' in ('page', 'group', 'link') then pg ->> 'kind' else 'page' end,
                nullif(pg ->> 'link_url', ''),
                case when coalesce(pg ->> 'kind', 'page') <> 'page' then now() end);
        report := jsonb_set(report, '{pages_creees}', to_jsonb((report ->> 'pages_creees')::int + 1));
      end if;
    end loop;

    -- 2) Place dans l'arbre, menu et texte.
    for pg in select value from jsonb_array_elements(sp -> 'pages') limit 500 loop
      continue when coalesce(pg ->> 'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$';
      select * into v_page from public.docs_pages where space_id = v_space.id and slug = pg ->> 'slug';
      continue when not found;
      if v_page.visibility = 'equipe' then
        ign := ign || jsonb_build_object('page', v_slug || '/' || v_page.slug, 'raison', 'page réservée à l''équipe');
        continue;
      end if;

      v_parent := null;
      if coalesce(pg ->> 'parent', '') <> '' then
        select id into v_parent from public.docs_pages where space_id = v_space.id and slug = pg ->> 'parent';
      end if;
      begin
        update public.docs_pages set
          parent_id = case when pg ? 'parent' then v_parent else parent_id end,
          position = case when jsonb_typeof(pg -> 'position') = 'number' then (pg ->> 'position')::double precision else position end,
          hidden = case when pg ? 'hidden' then coalesce((pg ->> 'hidden')::boolean, false) else hidden end,
          archived = case when pg ? 'archived' then coalesce((pg ->> 'archived')::boolean, false) else archived end,
          kind = case when pg ->> 'kind' in ('page', 'group', 'link') then pg ->> 'kind' else kind end,
          link_url = case when pg ? 'link_url' then nullif(pg ->> 'link_url', '') else link_url end,
          title = case when kind <> 'page' and pg ? 'title' then left(coalesce(nullif(btrim(pg ->> 'title'), ''), title), 160) else title end,
          icon = case when kind <> 'page' and pg ? 'icon' then left(coalesce(pg ->> 'icon', ''), 400) else icon end
        where id = v_page.id;
      exception when others then
        ign := ign || jsonb_build_object('page', v_slug || '/' || v_page.slug, 'raison', sqlerrm);
        continue;
      end;
      continue when v_page.kind <> 'page' or not (pg ? 'content');

      v_title := left(coalesce(nullif(btrim(pg ->> 'title'), ''), v_page.title), 160);
      v_desc := left(coalesce(pg ->> 'description', v_page.description), 300);
      v_icon := left(coalesce(pg ->> 'icon', v_page.icon), 400);
      v_content := coalesce(pg ->> 'content', '');
      v_note := left(coalesce(pg ->> 'note', ''), 500);
      v_base := case when jsonb_typeof(pg -> 'revision') = 'number' then (pg ->> 'revision')::int end;
      continue when length(v_content) > 400000;

      if v_page.revision > 0 and v_content = v_page.content and v_title = v_page.title
         and v_desc = v_page.description and v_icon = v_page.icon then
        report := jsonb_set(report, '{identiques}', to_jsonb((report ->> 'identiques')::int + 1));
        continue;
      end if;

      if not coalesce((pg ->> 'proposal')::boolean, false)
         and (v_page.revision = 0 or v_base = v_page.revision) then
        perform public.docs_write_revision(v_page.id, v_title, v_desc, v_icon, v_content,
          coalesce(nullif(v_note, ''), 'Envoyé depuis GitHub'), null, v_label, 'git');
        report := jsonb_set(report, '{publiees}', to_jsonb((report ->> 'publiees')::int + 1));
      else
        select * into v_draft from public.docs_drafts where page_id = v_page.id;
        if found and v_draft.content is not null and v_draft.source = 'site' then
          ign := ign || jsonb_build_object('page', v_slug || '/' || v_page.slug,
            'raison', 'brouillon en cours sur le site (' || v_draft.author_label || ') : proposition non déposée');
          continue;
        end if;
        insert into public.docs_drafts (page_id, title, description, icon, content, base_revision, author, author_label, source, note, updated_at)
        values (v_page.id, v_title, v_desc, v_icon, v_content, coalesce(v_base, v_page.revision), null, v_label, 'claude',
                coalesce(nullif(v_note, ''), 'Proposition envoyée depuis GitHub'), now())
        on conflict (page_id) do update set title = excluded.title, description = excluded.description, icon = excluded.icon,
          content = excluded.content, base_revision = excluded.base_revision, author = null, author_label = excluded.author_label,
          source = 'claude', note = excluded.note, updated_at = now();
        report := jsonb_set(report, '{propositions}', to_jsonb((report ->> 'propositions')::int + 1));
      end if;
    end loop;
  end loop;

  return jsonb_set(report, '{ignorees}', ign);
end $$;

revoke execute on function public.docs_git_sync(jsonb) from public, anon, authenticated;
grant execute on function public.docs_git_sync(jsonb) to service_role;
