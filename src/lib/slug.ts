// Même règle que docs_slugify() dans la base : minuscules, sans accents, tirets, 60 caractères au plus.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

// Ancres uniques dans une page : « regles », « regles-2 »…
export function uniqueSlugger() {
  const seen = new Map<string, number>();
  return (text: string, prefix = '') => {
    const base = prefix + (slugify(text) || 'section');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
}
