import { useEffect, useRef } from 'react';

// Contenu rendu d'une page, avec les onglets cliquables et le défilement vers l'ancre demandée.
export function Prose({ html, hash, className = '' }: { html: string; hash?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const tab = (e.target as Element).closest<HTMLButtonElement>('.tabs__tab');
      if (!tab || !el.contains(tab)) return;
      const box = tab.closest('.tabs')!;
      const k = tab.dataset.tab;
      box.querySelectorAll<HTMLButtonElement>(':scope > .tabs__bar > .tabs__tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
      box.querySelectorAll<HTMLElement>(':scope > .tabs__panel').forEach((p) => (p.hidden = p.dataset.panel !== k));
    };
    const onKey = (e: KeyboardEvent) => {
      const tab = (e.target as Element).closest<HTMLButtonElement>('.tabs__tab');
      if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      const all = [...tab.parentElement!.querySelectorAll<HTMLButtonElement>('.tabs__tab')];
      const i = all.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = all[(i + all.length) % all.length];
      next.focus();
      next.click();
    };
    // Tête Minecraft introuvable : on garde l'initiale à la place d'une image cassée.
    const onError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== 'IMG') return;
      if (img.classList.contains('role__face')) {
        const span = document.createElement('span');
        span.className = 'role__face role__face--empty';
        span.textContent = (img.closest('.role')?.querySelector('.role__name')?.textContent ?? '?').slice(0, 1).toUpperCase();
        img.replaceWith(span);
      } else if (img.closest('.roles-index')) {
        const span = document.createElement('span');
        span.className = 'roles-index__nohead';
        img.replaceWith(span);
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    el.addEventListener('error', onError, true);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('error', onError, true);
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => {
      const target = document.getElementById(hash);
      if (!target) return;
      // Ouvre l'onglet ou le dépliant qui cache la cible.
      let p: HTMLElement | null = target.parentElement;
      while (p && p !== ref.current) {
        if (p.classList.contains('tabs__panel') && p.hidden) {
          const box = p.closest('.tabs');
          box?.querySelector<HTMLButtonElement>(`:scope > .tabs__bar > [data-tab="${p.dataset.panel}"]`)?.click();
        }
        if (p.tagName === 'DETAILS') (p as HTMLDetailsElement).open = true;
        p = p.parentElement;
      }
      target.scrollIntoView({ block: 'start' });
      target.classList.add('is-target');
      setTimeout(() => target.classList.remove('is-target'), 1800);
    }, 30);
    return () => clearTimeout(t);
  }, [hash, html]);

  return <div ref={ref} className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
