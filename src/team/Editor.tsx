// Éditeur de page : Markdown à gauche, rendu exact à droite, brouillon enregistré tout seul,
// publication avec note, conflits, historique et propositions de Claude.
import {
  ArrowLeft, Bold, CheckSquare, ChevronDown, Code, Columns2, Eye, FileClock, Heading2, Heading3, HelpCircle, Image as ImageIcon,
  Italic, Link2, List, ListOrdered, Minus, PenLine, Quote, Send, Settings2, Sparkles, Table, Trash2, Undo2,
} from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Prose } from '../components/Article.tsx';
import { SpaceIcon } from '../components/Icon.tsx';
import { friendlyError } from '../lib/api.ts';
import { ago, dateTime } from '../lib/format.ts';
import { CALLOUT_LABEL, CALLOUTS, extractRoles, headUrl, renderMarkdown, type RoleRef } from '../lib/markdown.ts';
import { slugify } from '../lib/slug.ts';
import { invalidate, useData, usePages, useSession, useSpaces } from '../lib/store.ts';
import type { Draft, Page, Revision, Space } from '../lib/types.ts';
import { BASE, href, navigate } from '../router.ts';
import { setTitle } from '../views/SpaceView.tsx';
import { DiffView, Field, Modal, SourcePill, toast, Toasts } from './ui.tsx';

// ───────────── Chargement ─────────────

export default function Editor({ spaceSlug, pageSlug }: { spaceSlug: string; pageSlug: string }) {
  const { api, member } = useSession();
  const spaces = useSpaces();
  const space = spaces.data?.find((s) => s.slug === spaceSlug);
  const pages = usePages(member ? space?.id : undefined);
  const drafts = useData<Draft[]>(member ? 'team:drafts' : null, () => api.drafts());
  const [ready, setReady] = useState<{ page: Page; draft: Draft | null } | null>(null);

  const page = pages.data?.find((p) => p.slug === pageSlug);
  useEffect(() => {
    if (page && drafts.data && (!ready || ready.page.id !== page.id)) setReady({ page, draft: drafts.data.find((d) => d.page_id === page.id) ?? null });
  }, [page, drafts.data, ready]);

  if (!member) {
    return (
      <main className="main main--center">
        <div className="empty">
          <p className="empty__title">Réservé à l’équipe</p>
          <a className="btn" href={href('/equipe')}>Se connecter</a>
        </div>
      </main>
    );
  }
  const err = spaces.error ?? pages.error ?? drafts.error;
  if (err) return <main className="main main--center"><p className="form__error">{err}</p></main>;
  if (spaces.data && !space) return <main className="main main--center"><p>Espace introuvable.</p></main>;
  if (pages.data && !page) return <main className="main main--center"><p>Page introuvable.</p></main>;
  if (!space || !pages.data || !ready) return <main className="main main--center"><span className="spinner" /></main>;
  return <EditorBody key={ready.page.id} space={space} page={ready.page} draft={ready.draft} pages={pages.data} />;
}

// ───────────── Aides pour la zone de texte ─────────────

function insertText(ta: HTMLTextAreaElement, text: string, start = ta.selectionStart, end = ta.selectionEnd, select?: [number, number]) {
  ta.focus();
  ta.setSelectionRange(start, end);
  // execCommand garde l'annulation (Ctrl+Z) du navigateur ; sinon on remplace à la main.
  const ok = document.execCommand?.('insertText', false, text);
  if (!ok) {
    ta.setRangeText(text, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (select) ta.setSelectionRange(start + select[0], start + select[1]);
}

function wrap(ta: HTMLTextAreaElement, before: string, after: string, placeholder: string) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e) || placeholder;
  insertText(ta, before + sel + after, s, e, [before.length, before.length + sel.length]);
}

function prefixLines(ta: HTMLTextAreaElement, prefix: (i: number) => string) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const ls = value.lastIndexOf('\n', s - 1) + 1;
  const le = value.indexOf('\n', e) === -1 ? value.length : value.indexOf('\n', e);
  const lines = value.slice(ls, le).split('\n');
  const out = lines.map((l, i) => prefix(i) + l.replace(/^(\s*)([-*+] \[[ x]\] |[-*+] |\d+\. |#{1,6} |> )/, '$1')).join('\n');
  insertText(ta, out, ls, le, [0, out.length]);
}

// Insère un bloc sur sa propre ligne, entouré de lignes vides ; « ¦ » marque ce qui sera sélectionné.
function insertBlock(ta: HTMLTextAreaElement, block: string, start = ta.selectionStart, end = ta.selectionEnd) {
  const v = ta.value;
  const before = v.slice(0, start);
  const after = v.slice(end);
  const pre = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const post = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const a = block.indexOf('¦');
  const b = block.indexOf('¦', a + 1);
  const clean = block.replace(/¦/g, '');
  const text = pre + clean + post;
  const sel: [number, number] | undefined = a >= 0 ? [pre.length + a, pre.length + (b > a ? b - 1 : a)] : undefined;
  insertText(ta, text, start, end, sel);
}

function caretCoords(ta: HTMLTextAreaElement, pos: number) {
  const div = document.createElement('div');
  const cs = getComputedStyle(ta);
  const props = ['boxSizing', 'width', 'borderTopWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontWeight', 'fontSize', 'lineHeight', 'fontFamily', 'letterSpacing', 'tabSize'] as const;
  for (const p of props) div.style[p] = cs[p];
  Object.assign(div.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '0' });
  div.textContent = ta.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = '​';
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - ta.scrollTop + span.offsetHeight;
  const left = span.offsetLeft - ta.scrollLeft;
  div.remove();
  return { top, left };
}

type BlockItem = { id: string; label: string; hint: string; words: string; icon: React.ReactNode; run: (ta: HTMLTextAreaElement, s: number, e: number) => void };

// ───────────── L'éditeur ─────────────

function EditorBody({ space, page, draft, pages }: { space: Space; page: Page; draft: Draft | null; pages: Page[] }) {
  const { api, member } = useSession();
  const fromDraft = !!draft && draft.content !== null;
  const [title, setTitleState] = useState(fromDraft ? draft!.title ?? page.title : page.title);
  const [description, setDescription] = useState(fromDraft ? draft!.description ?? page.description : page.description);
  const [icon, setIcon] = useState(fromDraft ? draft!.icon ?? page.icon : page.icon);
  const [content, setContent] = useState(fromDraft ? draft!.content! : page.content);
  const [base, setBase] = useState(fromDraft ? draft!.base_revision : page.revision);
  const [online, setOnline] = useState<Page>(page);
  const [hasDraft, setHasDraft] = useState(fromDraft);
  const [proposal, setProposal] = useState<Draft | null>(fromDraft && draft!.source !== 'site' ? draft : null);
  const [otherDraft, setOtherDraft] = useState<Draft | null>(fromDraft && draft!.source === 'site' && draft!.author !== member?.id ? draft : null);
  const [save, setSave] = useState<{ state: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'; at?: string; error?: string }>({ state: fromDraft ? 'saved' : 'idle', at: draft?.updated_at });
  const [view, setView] = useState<'split' | 'write' | 'preview'>(() => (window.innerWidth < 900 ? 'write' : 'split'));
  const [modal, setModal] = useState<null | 'publish' | 'history' | 'settings' | 'help' | 'role' | 'compare' | 'discard'>(null);
  const [conflict, setConflict] = useState<Page | null>(null);
  const [slash, setSlash] = useState<{ start: number; q: string; top: number; left: number; sel: number; up: boolean } | null>(null);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const roleRange = useRef<[number, number]>([0, 0]);
  const dirty = useRef(false);
  const latest = useRef({ title, description, icon, content, base });
  latest.current = { title, description, icon, content, base };

  useEffect(() => setTitle(`Modifier ${title || page.title}`, space.title), [title, page.title, space.title]);

  const touch = useCallback(() => {
    dirty.current = true;
    setSave((s) => ({ ...s, state: 'dirty' }));
  }, []);

  const saveNow = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave((s) => ({ ...s, state: 'saving' }));
    const v = latest.current;
    try {
      const at = await api.saveDraft(page.id, { title: v.title, description: v.description, icon: v.icon, content: v.content, base: v.base });
      setHasDraft(true);
      setSave({ state: dirty.current ? 'dirty' : 'saved', at });
      invalidate('team:drafts');
    } catch (e) {
      dirty.current = true;
      setSave({ state: 'error', error: friendlyError(e) });
    }
  }, [api, page.id]);

  // Enregistrement automatique 1,2 s après la dernière frappe.
  useEffect(() => {
    if (save.state !== 'dirty') return;
    const t = setTimeout(saveNow, 1200);
    return () => clearTimeout(t);
  }, [save.state, title, description, icon, content, saveNow]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void saveNow();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [saveNow]);

  // Rendu de l'aperçu (différé pour garder la frappe fluide).
  const deferred = useDeferredValue(content);
  const allRoles: RoleRef[] = useMemo(() => {
    const out: RoleRef[] = [];
    for (const p of pages) {
      if (p.archived) continue;
      const roles = p.id === page.id ? extractRoles(deferred) : p.roles;
      out.push(...roles.map((r) => ({ ...r, page: p.slug, pageTitle: p.title })));
    }
    return out;
  }, [pages, page.id, deferred]);
  const preview = useMemo(() => renderMarkdown(deferred, { base: BASE, space: space.slug, camps: space.camps, roles: allRoles }), [deferred, space, allRoles]);

  // ── Images : bouton, coller, glisser ──
  const upload = useCallback(
    async (file: File) => {
      const el = ta.current;
      if (!el) return;
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return toast('Formats acceptés : PNG, JPEG, WebP, GIF.', 'err');
      if (file.size > 5 * 1024 * 1024) return toast('Image trop lourde (5 Mo au plus).', 'err');
      const tag = `![Envoi de ${file.name.replace(/[[\]]/g, '')}…]()`;
      insertBlock(el, tag);
      try {
        const url = await api.uploadImage(file, space.slug);
        setContent((c) => c.replace(tag, `![](${url})`));
        touch();
      } catch (e) {
        setContent((c) => c.replace(tag, ''));
        toast(friendlyError(e), 'err');
      }
    },
    [api, space.slug, touch],
  );

  // ── Blocs ──
  const blocks: BlockItem[] = useMemo(
    () => [
      ...CALLOUTS.map((k) => ({
        id: k, label: `Encadré ${CALLOUT_LABEL[k].toLowerCase()}`, hint: `:::${k}`, words: `encadre ${k} callout note`,
        icon: <span className={`blockicon blockicon--${k}`} />,
        run: (el: HTMLTextAreaElement, s: number, e: number) => insertBlock(el, `:::${k} ¦Titre¦\nTexte de l’encadré.\n:::`, s, e),
      })),
      { id: 'role', label: 'Carte de rôle', hint: ':::role', words: 'role personnage carte', icon: <Sparkles size={15} />, run: (_el, s, e) => ((roleRange.current = [s, e]), setModal('role')) },
      { id: 'roles', label: 'Liste des rôles', hint: '::roles', words: 'liste roles index', icon: <List size={15} />, run: (el, s, e) => insertBlock(el, '::roles', s, e) },
      { id: 'tabs', label: 'Onglets', hint: ':::tabs', words: 'onglets tabs', icon: <Columns2 size={15} />, run: (el, s, e) => insertBlock(el, ':::tabs\n:::tab ¦Premier onglet¦\nTexte.\n:::\n:::tab Second onglet\nTexte.\n:::\n:::', s, e) },
      { id: 'details', label: 'Dépliant', hint: ':::details', words: 'deplier details accordeon faq', icon: <ChevronDown size={15} />, run: (el, s, e) => insertBlock(el, ':::details ¦Question¦\nRéponse.\n:::', s, e) },
      { id: 'video', label: 'Vidéo YouTube', hint: '::video', words: 'video youtube', icon: <Eye size={15} />, run: (el, s, e) => insertBlock(el, '::video ¦https://www.youtube.com/watch?v=¦', s, e) },
      { id: 'table', label: 'Tableau', hint: '| a | b |', words: 'tableau table', icon: <Table size={15} />, run: (el, s, e) => insertBlock(el, '| ¦Colonne¦ | Colonne |\n| --- | --- |\n| Texte | Texte |', s, e) },
      { id: 'image', label: 'Image', hint: 'envoyer', words: 'image photo capture', icon: <ImageIcon size={15} />, run: () => fileRef.current?.click() },
      { id: 'h2', label: 'Grand titre', hint: '##', words: 'titre h2 section', icon: <Heading2 size={15} />, run: (el, s, e) => insertBlock(el, '## ¦Titre¦', s, e) },
      { id: 'h3', label: 'Petit titre', hint: '###', words: 'titre h3 sous', icon: <Heading3 size={15} />, run: (el, s, e) => insertBlock(el, '### ¦Titre¦', s, e) },
      { id: 'task', label: 'Liste à cocher', hint: '- [ ]', words: 'liste cocher taches', icon: <CheckSquare size={15} />, run: (el, s, e) => insertBlock(el, '- [ ] ¦À faire¦', s, e) },
      { id: 'hr', label: 'Séparateur', hint: '---', words: 'separateur ligne', icon: <Minus size={15} />, run: (el, s, e) => insertBlock(el, '---', s, e) },
    ],
    [],
  );
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slashItems = slash ? blocks.filter((b) => !slash.q || norm(b.label + ' ' + b.words).includes(norm(slash.q))) : [];

  const runSlash = (b: BlockItem | undefined) => {
    const el = ta.current;
    if (!el || !slash || !b) return;
    const end = el.selectionStart;
    setSlash(null);
    b.run(el, slash.start, end);
  };

  const updateSlash = () => {
    const el = ta.current;
    if (!el) return;
    const pos = el.selectionStart;
    const ls = el.value.lastIndexOf('\n', pos - 1) + 1;
    const m = /^\/([\p{L}\d]{0,20})$/u.exec(el.value.slice(ls, pos));
    if (m && el.selectionStart === el.selectionEnd) {
      const c = caretCoords(el, ls);
      // Près du bas de la zone, le menu s'ouvre vers le haut.
      const up = c.top + 330 > el.clientHeight && c.top > 200;
      setSlash((old) => ({ start: ls, q: m[1], top: c.top, left: c.left, up, sel: old && old.q === m[1] ? old.sel : 0 }));
    } else if (slash) setSlash(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (slash && slashItems.length) {
      if (e.key === 'ArrowDown') return e.preventDefault(), setSlash({ ...slash, sel: (slash.sel + 1) % slashItems.length });
      if (e.key === 'ArrowUp') return e.preventDefault(), setSlash({ ...slash, sel: (slash.sel - 1 + slashItems.length) % slashItems.length });
      if (e.key === 'Enter' || e.key === 'Tab') return e.preventDefault(), runSlash(slashItems[slash.sel]);
      if (e.key === 'Escape') return e.preventDefault(), setSlash(null);
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') return e.preventDefault(), wrap(el, '**', '**', 'texte en gras');
    if (mod && e.key.toLowerCase() === 'i') return e.preventDefault(), wrap(el, '*', '*', 'texte en italique');
    if (mod && e.key.toLowerCase() === 'k') return e.preventDefault(), wrap(el, '[', '](https://)', 'texte du lien');
    if (e.key === 'Tab' && !mod) {
      e.preventDefault();
      if (e.shiftKey) prefixLines(el, () => '');
      else insertText(el, '  ');
    }
    // Entrée dans une liste : on continue la liste (ou on la termine sur une ligne vide).
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const pos = el.selectionStart;
      const ls = el.value.lastIndexOf('\n', pos - 1) + 1;
      const line = el.value.slice(ls, pos);
      const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )(.*)$/.exec(line);
      if (m) {
        e.preventDefault();
        if (!m[4].trim()) insertText(el, '\n', ls, pos);
        else insertText(el, '\n' + m[1] + (m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace(/\[[xX]\]/, '[ ]')));
      }
    }
  };

  // Raccourcis globaux de l'éditeur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        setModal('publish');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  // Défilement de l'aperçu calé sur celui du texte.
  const onScroll = () => {
    const el = ta.current;
    const pv = previewRef.current;
    if (!el || !pv || view !== 'split') return;
    const r = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    pv.scrollTop = r * (pv.scrollHeight - pv.clientHeight);
    if (slash) setSlash(null);
  };

  const resetTo = (p: Page) => {
    setTitleState(p.title);
    setDescription(p.description);
    setIcon(p.icon);
    setContent(p.content);
    setBase(p.revision);
    setOnline(p);
    dirty.current = false;
    setSave({ state: 'idle' });
  };

  const publish = async (note: string, force = false) => {
    try {
      const rev = await api.publish(page.id, { title, description, icon, content, note, base, force });
      dirty.current = false;
      invalidate('pages:', 'overview', 'changelog', 'status', 'team:');
      toast(`Publié (version ${rev}).`);
      navigate(`/${space.slug}/${page.slug}`);
    } catch (e) {
      const m = /conflit:(\d+)/.exec(e instanceof Error ? e.message : String(e));
      if (m) {
        const fresh = (await api.pages(space.id)).find((p) => p.id === page.id) ?? null;
        setModal(null);
        setConflict(fresh);
      } else toast(friendlyError(e), 'err');
    }
  };

  const discard = async () => {
    try {
      await api.discardDraft(page.id);
      const fresh = (await api.pages(space.id)).find((p) => p.id === page.id) ?? page;
      resetTo(fresh);
      setHasDraft(false);
      setProposal(null);
      setOtherDraft(null);
      setModal(null);
      invalidate('team:drafts');
      toast(proposal ? 'Proposition rejetée.' : 'Brouillon abandonné : la version en ligne est revenue.');
    } catch (e) {
      toast(friendlyError(e), 'err');
    }
  };

  const tool = (label: string, icon: React.ReactNode, fn: (el: HTMLTextAreaElement) => void, kbd?: string) => (
    <button type="button" className="iconbtn iconbtn--tool" title={kbd ? `${label} (${kbd})` : label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={() => ta.current && fn(ta.current)}>
      {icon}
    </button>
  );

  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const saveLabel =
    save.state === 'saving' ? 'Enregistrement…' : save.state === 'dirty' ? 'Modifications en cours…' : save.state === 'error' ? `Brouillon non enregistré : ${save.error}` : save.state === 'saved' && save.at ? `Brouillon enregistré · ${dateTime(save.at)}` : page.published_at ? `En ligne · version ${online.revision}` : 'Jamais publiée';

  return (
    <div className="editor" style={{ ['--space' as string]: space.color }}>
      <header className="editor__bar">
        <a className="iconbtn" href={href(page.published_at ? `/${space.slug}/${page.slug}` : `/equipe/espace/${space.slug}#plan`)} title="Revenir à la page" aria-label="Revenir à la page">
          <ArrowLeft size={18} />
        </a>
        <a className="editor__space" href={href(`/equipe/espace/${space.slug}`)}>
          <SpaceIcon icon={space.icon} title={space.title} color={space.color} size={24} />
          <span>{space.title}</span>
        </a>
        <span className={`editor__save editor__save--${save.state}`}>{saveLabel}</span>
        <span className="editor__spacer" />
        <div className="seg" role="group" aria-label="Affichage">
          <button className={view === 'write' ? 'is-on' : ''} onClick={() => setView('write')} title="Texte seul">
            <PenLine size={15} /> <span>Écrire</span>
          </button>
          <button className={`seg__split ${view === 'split' ? 'is-on' : ''}`} onClick={() => setView('split')} title="Texte et aperçu">
            <Columns2 size={15} /> <span>Les deux</span>
          </button>
          <button className={view === 'preview' ? 'is-on' : ''} onClick={() => setView('preview')} title="Aperçu seul">
            <Eye size={15} /> <span>Aperçu</span>
          </button>
        </div>
        <button className="iconbtn" onClick={() => setModal('help')} title="Aide de mise en forme" aria-label="Aide">
          <HelpCircle size={18} />
        </button>
        <button className="iconbtn" onClick={() => setModal('history')} title="Historique des versions" aria-label="Historique">
          <FileClock size={18} />
        </button>
        <button className="iconbtn" onClick={() => setModal('settings')} title="Réglages de la page" aria-label="Réglages">
          <Settings2 size={18} />
        </button>
        {hasDraft && (
          <button className="btn btn--ghost btn--sm editor__discard" onClick={() => setModal('discard')}>
            <Undo2 size={14} /> <span>Abandonner</span>
          </button>
        )}
        <button className="btn btn--sm" onClick={() => setModal('publish')} title={`Publier (${mod} Entrée)`}>
          <Send size={14} /> Publier
        </button>
      </header>

      {proposal && (
        <div className="banner banner--claude">
          <Sparkles size={16} />
          <p>
            <strong>{proposal.source === 'claude' ? 'Proposition de Claude' : 'Proposition venue de GitHub'}</strong> · {ago(proposal.updated_at)}
            {proposal.note && <> · « {proposal.note} »</>}
            {proposal.base_revision < online.revision && <span className="warn"> · écrite sur la version {proposal.base_revision}, la page est à la {online.revision}</span>}
          </p>
          <button className="btn btn--ghost btn--sm" onClick={() => setModal('compare')}>Comparer</button>
          <button className="btn btn--danger btn--sm" onClick={discard}>Rejeter</button>
        </div>
      )}
      {otherDraft && !proposal && (
        <div className="banner">
          <PenLine size={16} />
          <p>
            Brouillon de <strong>{otherDraft.author_label || 'quelqu’un d’autre'}</strong> ({ago(otherDraft.updated_at)}). Tes modifications continuent ce brouillon.
          </p>
          <button className="btn btn--ghost btn--sm" onClick={() => setModal('compare')}>Comparer avec la page en ligne</button>
        </div>
      )}

      <div className="editor__meta">
        <IconPicker value={icon} onChange={(v) => (setIcon(v), touch())} title={title} />
        <div className="editor__titles">
          <input className="editor__title" value={title} onChange={(e) => (setTitleState(e.target.value), touch())} placeholder="Titre de la page" maxLength={160} aria-label="Titre" />
          <input className="editor__desc" value={description} onChange={(e) => (setDescription(e.target.value), touch())} placeholder="Une phrase de résumé (aperçus Discord, recherche)" maxLength={300} aria-label="Résumé" />
        </div>
      </div>

      <div className={`editor__panes editor__panes--${view}`}>
        <section className="editor__write" aria-label="Texte">
          <div className="toolbar" role="toolbar" aria-label="Mise en forme">
            {tool('Gras', <Bold size={16} />, (el) => wrap(el, '**', '**', 'texte en gras'), `${mod} B`)}
            {tool('Italique', <Italic size={16} />, (el) => wrap(el, '*', '*', 'texte en italique'), `${mod} I`)}
            {tool('Lien', <Link2 size={16} />, (el) => wrap(el, '[', '](https://)', 'texte du lien'), `${mod} K`)}
            {tool('Code', <Code size={16} />, (el) => wrap(el, '`', '`', '/commande'))}
            <span className="toolbar__sep" />
            {tool('Grand titre', <Heading2 size={16} />, (el) => prefixLines(el, () => '## '))}
            {tool('Petit titre', <Heading3 size={16} />, (el) => prefixLines(el, () => '### '))}
            {tool('Liste', <List size={16} />, (el) => prefixLines(el, () => '- '))}
            {tool('Liste numérotée', <ListOrdered size={16} />, (el) => prefixLines(el, (i) => `${i + 1}. `))}
            {tool('Liste à cocher', <CheckSquare size={16} />, (el) => prefixLines(el, () => '- [ ] '))}
            {tool('Citation', <Quote size={16} />, (el) => prefixLines(el, () => '> '))}
            {tool('Image', <ImageIcon size={16} />, () => fileRef.current?.click())}
            <span className="toolbar__sep" />
            <div className="blocksmenu">
              <button type="button" className="btn btn--ghost btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlocksOpen((o) => !o)} aria-expanded={blocksOpen}>
                <Sparkles size={14} /> Blocs <ChevronDown size={14} />
              </button>
              {blocksOpen && (
                <div className="menu" onMouseLeave={() => setBlocksOpen(false)}>
                  {blocks.map((b) => (
                    <button
                      key={b.id}
                      className="menu__item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setBlocksOpen(false);
                        const el = ta.current;
                        if (el) b.run(el, el.selectionStart, el.selectionEnd);
                      }}
                    >
                      <span className="menu__icon">{b.icon}</span>
                      <span>{b.label}</span>
                      <code>{b.hint}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="toolbar__hint muted">Tape « / » en début de ligne</span>
          </div>
          <div className="editor__area">
            <textarea
              ref={ta}
              value={content}
              spellCheck
              lang="fr"
              aria-label="Contenu de la page (Markdown)"
              placeholder={'Écris ici. Tape « / » en début de ligne pour ajouter un encadré, une carte de rôle, des onglets…'}
              onChange={(e) => {
                setContent(e.target.value);
                touch();
              }}
              onKeyDown={onKeyDown}
              onKeyUp={updateSlash}
              onClick={() => setSlash(null)}
              onInput={updateSlash}
              onScroll={onScroll}
              onPaste={(e) => {
                const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/'));
                if (f) {
                  e.preventDefault();
                  void upload(f);
                }
              }}
              onDrop={(e) => {
                const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
                if (f) {
                  e.preventDefault();
                  void upload(f);
                }
              }}
            />
            {slash && slashItems.length > 0 && (
              <div className="menu menu--slash" style={slash.up ? { top: 'auto', bottom: `calc(100% - ${slash.top - 26}px)`, left: Math.min(slash.left, 240) } : { top: slash.top + 4, left: Math.min(slash.left, 240) }} role="listbox">
                {slashItems.map((b, i) => (
                  <button
                    key={b.id}
                    className="menu__item"
                    aria-selected={i === slash.sel}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => slash.sel !== i && setSlash({ ...slash, sel: i })}
                    onClick={() => runSlash(b)}
                  >
                    <span className="menu__icon">{b.icon}</span>
                    <span>{b.label}</span>
                    <code>{b.hint}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
        </section>
        <section className="editor__preview" ref={previewRef} aria-label="Aperçu">
          <article className="article">
            <header className="article__head">
              <h1 className="article__title">
                {icon && <SpaceIcon icon={icon} title={title} size={38} />}
                {title || 'Sans titre'}
              </h1>
              {description && <p className="article__lead">{description}</p>}
            </header>
            {deferred.trim() ? <Prose html={preview.html} /> : <p className="muted">L’aperçu de la page apparaîtra ici.</p>}
          </article>
        </section>
      </div>

      {modal === 'publish' && <PublishModal onClose={() => setModal(null)} onPublish={(note) => publish(note)} defaultNote={proposal?.note ?? ''} first={!page.published_at} before={online.content} after={content} />}
      {modal === 'compare' && (
        <Modal title="Différences avec la page en ligne" wide onClose={() => setModal(null)}>
          <DiffView before={online.content} after={content} />
        </Modal>
      )}
      {modal === 'discard' && (
        <Modal
          title={proposal ? 'Rejeter la proposition ?' : 'Abandonner le brouillon ?'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn--danger" onClick={discard}>
                <Trash2 size={14} /> {proposal ? 'Rejeter' : 'Abandonner'}
              </button>
            </>
          }
        >
          <p>Le texte en cours sera remplacé par la version en ligne de la page. Ce qui est publié ne change pas.</p>
        </Modal>
      )}
      {conflict && (
        <Modal
          title="Quelqu’un a publié cette page entre-temps"
          wide
          onClose={() => setConflict(null)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => (resetTo(conflict), setConflict(null), toast('Version en ligne reprise.'))}>Reprendre la version en ligne</button>
              <button className="btn" onClick={() => (setConflict(null), setModal('publish'), setBase(conflict.revision), setOnline(conflict))}>Garder mon texte et publier</button>
            </>
          }
        >
          <p className="muted">
            La page est passée à la version {conflict.revision} pendant que tu écrivais. En rouge ce qu’il y a en ligne, en vert ton texte. Si tu gardes ton texte, il remplacera la version en ligne (elle reste dans l’historique).
          </p>
          <DiffView before={conflict.content} after={content} />
        </Modal>
      )}
      {modal === 'history' && (
        <HistoryModal
          page={page}
          current={online}
          onClose={() => setModal(null)}
          onRestored={(p) => {
            resetTo(p);
            setHasDraft(false);
            setProposal(null);
            setModal(null);
          }}
        />
      )}
      {modal === 'settings' && <PageSettings space={space} page={page} onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'role' && (
        <RoleModal
          space={space}
          onClose={() => setModal(null)}
          onInsert={(text) => {
            setModal(null);
            const el = ta.current;
            if (el) setTimeout(() => insertBlock(el, text, roleRange.current[0], roleRange.current[1]), 0);
          }}
        />
      )}
      <Toasts />
    </div>
  );
}

// ───────────── Morceaux de l'éditeur ─────────────

function IconPicker({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  const [open, setOpen] = useState(false);
  const emojis = ['📜', '🎭', '⚔️', '🛡️', '🗺️', '🏰', '🔥', '🌙', '⭐', '💀', '🧪', '🧭', '❓', '⚙️', '🏆', '🎲'];
  return (
    <div className="iconpick">
      <button type="button" className="iconpick__btn" onClick={() => setOpen((o) => !o)} title="Icône de la page" aria-label="Icône de la page">
        {value ? <SpaceIcon icon={value} title={title} size={40} /> : <span className="iconpick__empty">+</span>}
      </button>
      {open && (
        <div className="menu iconpick__menu" onMouseLeave={() => setOpen(false)}>
          <div className="iconpick__grid">
            {emojis.map((e) => (
              <button key={e} type="button" onClick={() => (onChange(e), setOpen(false))}>
                {e}
              </button>
            ))}
          </div>
          <label className="form__label">Ou un pseudo Minecraft (tête du skin), un emoji, une adresse d’image</label>
          <input className="input" value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="Ex. Notch" />
          {value && (
            <button type="button" className="link" onClick={() => (onChange(''), setOpen(false))}>
              Retirer l’icône
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PublishModal({ onClose, onPublish, defaultNote, first, before, after }: { onClose: () => void; onPublish: (note: string) => Promise<void>; defaultNote: string; first: boolean; before: string; after: string }) {
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState(false);
  return (
    <Modal
      title={first ? 'Publier la page' : 'Publier les modifications'}
      onClose={onClose}
      wide={diff}
      footer={
        <>
          {!first && (
            <button className="btn btn--ghost" onClick={() => setDiff((d) => !d)}>
              {diff ? 'Masquer les différences' : 'Voir les différences'}
            </button>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onPublish(note.trim());
              setBusy(false);
            }}
          >
            <Send size={14} /> {busy ? 'Publication…' : 'Publier'}
          </button>
        </>
      }
    >
      <Field label="Qu’est-ce qui change ?" hint="Facultatif. Si tu écris une note, elle apparaît dans les Nouveautés et peut être annoncée sur Discord. Laisse vide pour une simple correction.">
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Le Profond perd sa vitesse sous l’eau." autoFocus maxLength={500} />
      </Field>
      {diff && <DiffView before={before} after={after} />}
    </Modal>
  );
}

function HistoryModal({ page, current, onClose, onRestored }: { page: Page; current: Page; onClose: () => void; onRestored: (p: Page) => void }) {
  const { api } = useSession();
  const revs = useData<Revision[]>(`team:revs:${page.id}:${current.revision}`, () => api.revisions(page.id));
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = revs.data?.find((r) => r.revision === sel) ?? revs.data?.[1] ?? revs.data?.[0];
  return (
    <Modal title="Historique des versions" wide onClose={onClose}>
      {revs.error && <p className="form__error">{revs.error}</p>}
      {!revs.data ? (
        <span className="spinner" />
      ) : !revs.data.length ? (
        <p className="muted">Aucune version publiée pour l’instant.</p>
      ) : (
        <div className="history">
          <ol className="history__list">
            {revs.data.map((r) => (
              <li key={r.id}>
                <button className={r.revision === chosen?.revision ? 'is-on' : ''} onClick={() => setSel(r.revision)}>
                  <span className="history__rev">
                    Version {r.revision} {r.revision === current.revision && <span className="pill pill--ok">en ligne</span>}
                  </span>
                  <span className="history__meta">
                    {dateTime(r.created_at)} · {r.author_label || '—'} <SourcePill source={r.source} />
                  </span>
                  {r.note && <span className="history__note">{r.note}</span>}
                </button>
              </li>
            ))}
          </ol>
          {chosen && (
            <div className="history__diff">
              <div className="history__actions">
                <p className="muted small">
                  {chosen.revision === current.revision ? 'C’est la version en ligne.' : `Différences entre la version ${chosen.revision} (rouge) et la version en ligne (vert).`}
                </p>
                {chosen.revision !== current.revision && (
                  <button
                    className="btn btn--sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const rev = await api.restore(page.id, chosen.revision);
                        invalidate('pages:', 'changelog', 'team:', 'overview');
                        toast(`Version ${chosen.revision} remise en ligne (devient la version ${rev}).`);
                        onRestored({ ...current, title: chosen.title, description: chosen.description, icon: chosen.icon, content: chosen.content, revision: rev });
                      } catch (e) {
                        toast(friendlyError(e), 'err');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Undo2 size={14} /> Remettre cette version
                  </button>
                )}
              </div>
              <DiffView before={chosen.content} after={current.content} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PageSettings({ space, page, onClose }: { space: Space; page: Page; onClose: () => void }) {
  const { api } = useSession();
  const [slug, setSlug] = useState(page.slug);
  const [visibility, setVisibility] = useState(page.visibility);
  const [hidden, setHidden] = useState(page.hidden);
  const [busy, setBusy] = useState(false);
  const apply = async (patch: Parameters<typeof api.updatePage>[1], msg: string) => {
    setBusy(true);
    try {
      await api.updatePage(page.id, patch);
      invalidate('pages:', 'team:', 'overview');
      toast(msg);
      return true;
    } catch (e) {
      toast(friendlyError(e), 'err');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Réglages de la page" onClose={onClose}>
      <div className="form">
        <Field label="Adresse" hint={`…/${space.slug}/${slugify(slug) || '…'} · changer l’adresse casse les anciens liens partagés.`}>
          <div className="inline">
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy || slugify(slug) === page.slug}
              onClick={async () => {
                if (await apply({ slug: slugify(slug) }, 'Adresse changée.')) navigate(`/equipe/editer/${space.slug}/${slugify(slug)}`, { replace: true });
              }}
            >
              Changer
            </button>
          </div>
        </Field>
        <Field label="Qui peut lire cette page ?">
          <select className="input" value={visibility} onChange={(e) => (setVisibility(e.target.value as Page['visibility']), apply({ visibility: e.target.value as Page['visibility'] }, 'Visibilité changée.'))}>
            <option value="public">Tout le monde</option>
            <option value="equipe">L’équipe Tsuki seulement</option>
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={hidden} onChange={(e) => (setHidden(e.target.checked), apply({ hidden: e.target.checked }, e.target.checked ? 'Page masquée du sommaire.' : 'Page affichée dans le sommaire.'))} />
          <span>Masquer du sommaire (la page reste lisible par son lien)</span>
        </label>
        <div className="form__actions">
          <button
            className="btn btn--danger btn--sm"
            disabled={busy}
            onClick={async () => {
              if (await apply({ archived: true }, 'Page mise à la corbeille.')) navigate(`/equipe/espace/${space.slug}#plan`);
            }}
          >
            <Trash2 size={14} /> Mettre à la corbeille
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RoleModal({ space, onClose, onInsert }: { space: Space; onClose: () => void; onInsert: (text: string) => void }) {
  const [name, setName] = useState('');
  const [camp, setCamp] = useState(space.camps[0]?.name ?? '');
  const [head, setHead] = useState('');
  const [text, setText] = useState('');
  const build = () => {
    const attrs = [camp && `camp="${camp.replace(/"/g, '')}"`, head && `tete="${head.replace(/"/g, '')}"`].filter(Boolean).join(' ');
    return `:::role ${name.trim() || 'Nom du rôle'}${attrs ? ` {${attrs}}` : ''}\n${text.trim() || 'Pouvoirs et objectif du rôle.'}\n:::`;
  };
  return (
    <Modal
      title="Carte de rôle"
      onClose={onClose}
      footer={
        <button className="btn" onClick={() => onInsert(build())}>
          Ajouter la carte
        </button>
      }
    >
      <div className="form">
        <div className="role-preview">
          {head ? <img src={headUrl(head, 64)} alt="" width={44} height={44} /> : <span className="role-preview__empty">{(name || '?').slice(0, 1)}</span>}
          <div>
            <strong>{name || 'Nom du rôle'}</strong>
            <span className="muted"> {camp}</span>
          </div>
        </div>
        <Field label="Nom du rôle">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Camp" hint={space.camps.length ? 'Les camps se règlent dans la fiche de l’espace (couleurs).' : 'Astuce : déclare les camps dans la fiche de l’espace pour leur donner une couleur.'}>
          <input className="input" list="camps-list" value={camp} onChange={(e) => setCamp(e.target.value)} />
          <datalist id="camps-list">
            {space.camps.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Tête (pseudo Minecraft du skin)">
          <input className="input" value={head} onChange={(e) => setHead(e.target.value.trim())} placeholder="Ex. Notch" />
        </Field>
        <Field label="Description">
          <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="La première ligne sert de résumé dans la liste des rôles et dans /role sur Discord." />
        </Field>
      </div>
    </Modal>
  );
}

const HELP: [string, string][] = [
  ['**gras**, *italique*, `commande`', 'Mise en forme du texte'],
  ['## Titre\n### Sous-titre', 'Titres (le sommaire de droite les reprend)'],
  ['- élément\n1. élément\n- [ ] à cocher', 'Listes'],
  ['[texte](https://…)\n[règles](./regles)\n[autre mode](/naruto-uw/roles)', 'Liens : externe, page du même espace, autre espace'],
  [':::info Titre\nTexte\n:::', 'Encadrés : info, astuce, attention, danger'],
  [':::role Itachi {camp="Akatsuki" tete="Itachi"}\nRésumé du rôle\n:::', 'Carte de rôle (apparaît dans « Tous les rôles », la recherche et /role sur Discord)'],
  ['::roles\n::roles {camp="Akatsuki"}', 'Liste des rôles de l’espace (tous ou d’un camp)'],
  [':::tabs\n:::tab Jour\nTexte\n:::\n:::tab Nuit\nTexte\n:::\n:::', 'Onglets'],
  [':::details Question\nRéponse\n:::', 'Dépliant (FAQ)'],
  ['::video https://youtu.be/…', 'Vidéo YouTube'],
  ['| A | B |\n| --- | --- |\n| 1 | 2 |', 'Tableau'],
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Aide de mise en forme" wide onClose={onClose}>
      <p className="muted">Les pages s’écrivent en Markdown, avec quelques blocs en plus pour les modes UHC. Tape « / » en début de ligne pour les insérer sans rien retenir. Les images se collent ou se glissent directement dans le texte.</p>
      <table className="helptable">
        <tbody>
          {HELP.map(([code, label]) => (
            <tr key={label}>
              <td>
                <pre>{code}</pre>
              </td>
              <td>{label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Raccourcis : Ctrl S enregistre le brouillon, Ctrl Entrée publie, Ctrl B / I / K pour gras, italique, lien.</p>
    </Modal>
  );
}
