import { useEffect, useState } from 'react';
import type { Heading } from '../lib/markdown.ts';

// La lune de lecture : un croissant qui se remplit jusqu'à la pleine lune en fin de page.
export function ReadingMoon({ size = 34 }: { size?: number }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 40 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1);
    };
    const on = () => (raf ||= requestAnimationFrame(update));
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  const r = 14;
  // L'ombre glisse vers la droite : nouvelle lune (0 %) → pleine lune (100 %).
  const shift = 4 + p * (2 * r + 2);
  return (
    <span className="moon" title={`${Math.round(p * 100)} % lu`} aria-label={`${Math.round(p * 100)} % de la page lue`} role="img">
      <svg width={size} height={size} viewBox="0 0 32 32">
        <defs>
          <radialGradient id="moon-lit" cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="var(--moon-1)" />
            <stop offset="1" stopColor="var(--moon-2)" />
          </radialGradient>
          <clipPath id="moon-clip">
            <circle cx="16" cy="16" r={r} />
          </clipPath>
        </defs>
        <circle cx="16" cy="16" r={r} fill="url(#moon-lit)" />
        <circle cx={16 + shift} cy="16" r={r + 0.5} fill="var(--moon-shadow)" clipPath="url(#moon-clip)" />
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      </svg>
    </span>
  );
}

export function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!headings.length) return;
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [headings]);

  return (
    <aside className="toc" aria-label="Sur cette page">
      <div className="toc__head">
        <ReadingMoon />
        <span>Sur cette page</span>
      </div>
      {headings.length > 0 ? (
        <ol>
          {headings.map((h) => (
            <li key={h.id} className={`toc__item toc__item--${h.kind ?? 'h' + h.level} ${active === h.id ? 'is-active' : ''}`}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">Page courte, pas de sections.</p>
      )}
    </aside>
  );
}
