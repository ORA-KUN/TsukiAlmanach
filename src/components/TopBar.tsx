import { Menu, Moon, Search, Sun, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { href, useLocation } from '../router.ts';
import { useSession } from '../lib/store.ts';
import { Head, Logo } from './Icon.tsx';

export function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'jour');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  // Le choix n'est retenu que si le lecteur clique : sinon, le site suit l'appareil.
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'nuit' ? 'jour' : 'nuit';
      try {
        localStorage.setItem('almanach-theme', next);
      } catch {
        /* rien */
      }
      return next;
    });
  return [theme, toggle];
}

export function TopBar({ onSearch, onMenu, showMenu }: { onSearch: () => void; onMenu: () => void; showMenu: boolean }) {
  const { member, api } = useSession();
  const { path } = useLocation();
  const [theme, toggle] = useTheme();
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {showMenu && (
          <button className="iconbtn topbar__menu" onClick={onMenu} aria-label="Ouvrir le sommaire">
            <Menu size={20} />
          </button>
        )}
        <a className="brand" href={href('/')}>
          <Logo />
          <span className="brand__name">Almanach</span>
          <span className="brand__by">Tsuki</span>
        </a>
        {api.mode === 'demo' && <span className="pill pill--demo">Démo</span>}
        <button className="searchbtn" onClick={onSearch} aria-label="Rechercher">
          <Search size={16} />
          <span className="searchbtn__label">Chercher un mode, une règle, un rôle…</span>
          <kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <nav className="topbar__nav">
          <a href={href('/')} className={path === '/' ? 'is-active' : ''}>Modes</a>
          <a href={href('/nouveautes')} className={path === '/nouveautes' ? 'is-active' : ''}>Nouveautés</a>
        </nav>
        <button className="iconbtn" onClick={toggle} aria-label={theme === 'nuit' ? 'Passer en mode jour' : 'Passer en mode nuit'} title={theme === 'nuit' ? 'Mode jour' : 'Mode nuit'}>
          {theme === 'nuit' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a className={`teambtn ${path.startsWith('/equipe') ? 'is-active' : ''}`} href={href('/equipe')} title={member ? 'Espace équipe' : 'Connexion équipe'}>
          {member?.mc_name ? <Head name={member.mc_name} size={22} /> : <UserRound size={18} />}
          <span>{member ? 'Équipe' : 'Équipe'}</span>
        </a>
      </div>
    </header>
  );
}
