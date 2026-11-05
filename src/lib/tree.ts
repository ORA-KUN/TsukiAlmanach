// Arbre des pages d'un espace : ordre de lecture, fil d'Ariane, page précédente et suivante.
import type { Page } from './types.ts';

export type TreeNode = Page & { children: TreeNode[]; depth: number };

export type TreeOptions = { hidden?: boolean; archived?: boolean; unpublished?: boolean };

export function visibleForReading(p: Page, o: TreeOptions = {}): boolean {
  if (p.archived && !o.archived) return false;
  if (p.hidden && !o.hidden) return false;
  if (!p.published_at && !o.unpublished) return false;
  return true;
}

export function buildTree(pages: Page[], o: TreeOptions = {}): TreeNode[] {
  const keep = pages.filter((p) => visibleForReading(p, o));
  const ids = new Set(keep.map((p) => p.id));
  const byParent = new Map<string | null, Page[]>();
  for (const p of keep) {
    const parent = p.parent_id && ids.has(p.parent_id) ? p.parent_id : null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(p);
  }
  const make = (parent: string | null, depth: number): TreeNode[] =>
    (byParent.get(parent) ?? [])
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, 'fr'))
      .map((p) => ({ ...p, depth, children: make(p.id, depth + 1) }));
  return make(null, 0);
}

export function flatten(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (ns: TreeNode[]) => ns.forEach((n) => (out.push(n), walk(n.children)));
  walk(tree);
  return out;
}

// Pages lisibles dans l'ordre (sans groupes ni liens).
export function readingOrder(tree: TreeNode[]): TreeNode[] {
  return flatten(tree).filter((n) => n.kind === 'page');
}

export function ancestors(pages: Page[], id: string): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: Page[] = [];
  let cur = byId.get(id)?.parent_id ?? null;
  let guard = 0;
  while (cur && guard++ < 50) {
    const p = byId.get(cur);
    if (!p) break;
    out.unshift(p);
    cur = p.parent_id;
  }
  return out;
}
