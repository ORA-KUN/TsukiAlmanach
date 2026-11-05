import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { diffLines, diffWords } from 'diff';

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="palette modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal__box ${wide ? 'modal__box--wide' : ''}`}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

// Petites notifications en bas de l'écran.
type ToastItem = { id: number; text: string; kind: 'ok' | 'err' };
let toasts: ToastItem[] = [];
const subs = new Set<(t: ToastItem[]) => void>();
let nextId = 1;
export function toast(text: string, kind: 'ok' | 'err' = 'ok') {
  const t = { id: nextId++, text, kind };
  toasts = [...toasts, t];
  subs.forEach((s) => s(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    subs.forEach((s) => s(toasts));
  }, kind === 'err' ? 7000 : 3500);
}
export function Toasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => {
    subs.add(setList);
    return () => {
      subs.delete(setList);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`form__field ${wide ? 'form__field--wide' : ''}`}>
      <span className="form__label">{label}</span>
      {children}
      {hint && <span className="form__hint">{hint}</span>}
    </label>
  );
}

// Différences entre deux textes : lignes ajoutées, retirées, et mots changés à l'intérieur.
export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = diffLines(before ?? '', after ?? '');
  if (parts.length === 1 && !parts[0].added && !parts[0].removed) return <p className="muted">Aucune différence.</p>;
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const n = parts[i + 1];
    if (p.removed && n?.added) {
      // Modification : on montre les mots changés.
      const words = diffWords(p.value, n.value);
      rows.push(
        <div key={i} className="diff__row diff__row--del">
          {words.filter((w) => !w.added).map((w, k) => (w.removed ? <del key={k}>{w.value}</del> : <span key={k}>{w.value}</span>))}
        </div>,
        <div key={i + 'a'} className="diff__row diff__row--add">
          {words.filter((w) => !w.removed).map((w, k) => (w.added ? <ins key={k}>{w.value}</ins> : <span key={k}>{w.value}</span>))}
        </div>,
      );
      i++;
    } else if (p.added) rows.push(<div key={i} className="diff__row diff__row--add">{p.value}</div>);
    else if (p.removed) rows.push(<div key={i} className="diff__row diff__row--del">{p.value}</div>);
    else {
      const lines = p.value.replace(/\n$/, '').split('\n');
      const text = lines.length > 6 ? [...lines.slice(0, 2), `⋯ ${lines.length - 4} lignes identiques`, ...lines.slice(-2)].join('\n') : p.value.replace(/\n$/, '');
      rows.push(<div key={i} className="diff__row diff__row--same">{text}</div>);
    }
  }
  return <div className="diff">{rows}</div>;
}

export function SourcePill({ source }: { source: string }) {
  if (source === 'claude') return <span className="pill pill--claude">Claude</span>;
  if (source === 'git') return <span className="pill pill--git">GitHub</span>;
  if (source === 'restauration') return <span className="pill">Restauration</span>;
  return <span className="pill">Site</span>;
}
