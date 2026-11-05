import type { Camp, RoleRef } from './markdown.ts';

export type Visibility = 'public' | 'equipe';

export type Space = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  kind: 'mode' | 'guide';
  icon: string;
  color: string;
  cover_url: string | null;
  family: string;
  version_label: string;
  universe: string;
  credits: string;
  origin_url: string | null;
  mc_version: string;
  command: string;
  players: string;
  camps: Camp[];
  catalog_key: string | null;
  mode_id: string | null;
  visibility: Visibility;
  published: boolean;
  archived: boolean;
  position: number;
  updated_at: string;
};

export type PageKind = 'page' | 'group' | 'link';

export type Page = {
  id: string;
  space_id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  icon: string;
  kind: PageKind;
  link_url: string | null;
  description: string;
  content: string;
  roles: RoleRef[];
  visibility: Visibility;
  hidden: boolean;
  archived: boolean;
  position: number;
  revision: number;
  published_at: string | null;
  updated_at: string;
};

// Index léger de toutes les pages (espace équipe : brouillons, statistiques, corbeille).
export type PageLite = Pick<Page, 'id' | 'space_id' | 'parent_id' | 'slug' | 'title' | 'icon' | 'kind' | 'archived' | 'hidden' | 'visibility' | 'revision' | 'published_at' | 'updated_at'>;

export type Draft = {
  page_id: string;
  title: string | null;
  description: string | null;
  icon: string | null;
  content: string | null;
  base_revision: number;
  author: string | null;
  author_label: string;
  source: 'site' | 'claude' | 'git';
  note: string;
  updated_at: string;
};

export type Revision = {
  id: number;
  page_id: string;
  revision: number;
  title: string;
  description: string;
  icon: string;
  content: string;
  author_label: string;
  source: 'site' | 'claude' | 'git' | 'restauration';
  note: string;
  created_at: string;
};

export type SearchHit = {
  kind: 'page' | 'role';
  page_id: string;
  space_id: string;
  space_slug: string;
  space_title: string;
  space_icon: string;
  page_slug: string;
  title: string;
  icon: string | null; // pour un rôle : sa tête
  anchor: string | null;
  camp: string | null;
  snippet: string | null;
  score: number;
};

export type ChangelogEntry = {
  space_slug: string;
  space_title: string;
  space_icon: string;
  page_slug: string;
  page_title: string;
  revision: number;
  note: string;
  author_label: string;
  created_at: string;
};

export type Overview = { space_id: string; pages: number; roles: number; updated_at: string | null };

export type StatRow = { page_id: string; day: string; views: number; up: number; down: number };

export type Member = { id: string; email: string; pseudo: string; mc_name: string | null; admin: boolean };

export type CatalogRow = { seed_key: string; name: string; version: string; creator: string; mc_version: string; status: string; mode_id: string | null; doc_url: string | null };

export type SpaceStatus = { space_id: string; status: string };

export const STATUS_LABEL: Record<string, string> = { fait: 'Disponible', en_cours: 'En cours', pas_fait: 'À venir' };
