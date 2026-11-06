import { useState } from 'react';
import { iconSpec } from '../lib/markdown.ts';

// Icône d'espace ou de page : tête Minecraft, image ou emoji ; à défaut, l'initiale sur la couleur de l'espace.
export function SpaceIcon({ icon, title, color, size = 40, className = '' }: { icon: string | null | undefined; title?: string; color?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const spec = iconSpec(failed === icon ? '' : icon, size >= 48 ? 128 : 64);
  const style = { width: size, height: size, ['--icon-color' as string]: color ?? 'var(--accent)' } as React.CSSProperties;
  if (spec.kind === 'image') return <img className={`sicon sicon--img ${className}`} src={spec.src} alt="" width={size} height={size} style={style} loading="lazy" onError={() => setFailed(icon ?? '')} />;
  if (spec.kind === 'emoji') return <span className={`sicon sicon--emoji ${className}`} style={{ ...style, fontSize: size * 0.6 }} aria-hidden="true">{spec.value}</span>;
  return (
    <span className={`sicon sicon--letter ${className}`} style={{ ...style, fontSize: size * 0.48 }} aria-hidden="true">
      {(title ?? '?').trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

// Le logo : un croissant posé sur la tranche d'un livre.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-2)' }} />
        </linearGradient>
        <mask id="logo-m">
          <rect width="32" height="32" fill="#fff" />
          <circle cx="20.5" cy="10.5" r="8.2" fill="#000" />
        </mask>
      </defs>
      <circle cx="15" cy="13" r="10" fill="url(#logo-g)" mask="url(#logo-m)" />
      <path d="M5 25.5c3.6-1.6 7.3-1.6 11 0 3.7-1.6 7.4-1.6 11 0" fill="none" stroke="url(#logo-g)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 25.5v-3.2" stroke="url(#logo-g)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Head({ name, size = 24 }: { name: string; size?: number }) {
  if (!name) return null;
  return <img className="head" src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size * 2}`} alt="" width={size} height={size} loading="lazy" />;
}
