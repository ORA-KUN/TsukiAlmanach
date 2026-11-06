import { useEffect, useState } from 'react';
import { AlignLeft } from 'lucide-react';
import type { Heading } from '../lib/markdown.ts';

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
        <AlignLeft size={14} />
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
