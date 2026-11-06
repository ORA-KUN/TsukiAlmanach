-- Lien Tsuki → Almanach, version 2 :
-- · un Google Doc d'origine (document interne de l'équipe) n'est jamais affiché comme « doc d'origine » sur le site public ;
-- · un ancien lien vers l'Almanach lui-même (changement de nom de domaine) n'est pas recopié dans les notes de la ligne.
create or replace function public.docs_link_catalog(p_space uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.docs_spaces;
  cfg public.docs_settings;
  url text;
  c public.catalog;
  own boolean;
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
  own := c.doc_url is not null and (position(cfg.site_url in c.doc_url) = 1 or c.doc_url ~* '(/TsukiAlmanach/|docs-almanach\.fr)');
  if c.doc_url is not null and not own and position(c.doc_url in coalesce(c.doc, '')) = 0 then
    update public.catalog set doc = concat_ws(E'\n', nullif(btrim(coalesce(doc, '')), ''), c.doc_url) where id = c.id;
  end if;
  if c.doc_url is not null and not own and s.origin_url is null and c.doc_url !~* '^https?://docs\.google\.com/' then
    update public.docs_spaces set origin_url = c.doc_url where id = s.id;
  end if;
  update public.catalog set doc_url = url where id = c.id;
end $$;
