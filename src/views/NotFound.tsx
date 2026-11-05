import { useEffect } from 'react';
import { href } from '../router.ts';
import { setTitle } from './SpaceView.tsx';

export function NotFound() {
  useEffect(() => setTitle('Page introuvable'), []);
  return (
    <main className="main main--center" id="contenu">
      <div className="empty empty--big">
        <p className="empty__moon" aria-hidden="true">🌑</p>
        <p className="empty__title">Cette page s’est perdue dans la nuit</p>
        <p className="muted">Elle a peut-être changé d’adresse, ou n’existe pas encore.</p>
        <a className="btn" href={href('/')}>Retour à l’accueil</a>
      </div>
    </main>
  );
}
