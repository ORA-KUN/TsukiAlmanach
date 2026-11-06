import '@fontsource-variable/inter/wght.css';
import '@fontsource/geist-mono/400.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { getApi } from './lib/api.ts';
import { load } from './lib/store.ts';
import { matchRoute } from './router.ts';

// Le thème est posé avant tout affichage par le petit script d'index.html (jour par défaut,
// nuit si l'appareil est en mode sombre ou si le lecteur l'a choisi).

const api = await getApi();
const member = await api.me().catch(() => null);

// Les pages sont déjà écrites dans le HTML (pré-rendu) : on charge les données de l'écran avant
// d'afficher l'application, pour éviter un clignotement. Au bout de 4 s, on affiche quand même.
const m = member ? 'm' : 'v';
const route = matchRoute({ path: location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '').replace(/\/+$/, '') || '/', search: new URLSearchParams(location.search), hash: '' });
const preload = (async () => {
  const spaces = await load(`spaces:${m}`, () => api.spaces());
  if (route.name === 'home') await Promise.all([load(`overview:${m}`, () => api.overview()), load(`status:${m}`, () => api.status())]);
  if (route.name === 'space' || route.name === 'roles') {
    const s = spaces.find((x) => x.slug === route.space);
    if (s) await Promise.all([load(`pages:${s.id}:${m}`, () => api.pages(s.id)), load(`status:${m}`, () => api.status()), load(`overview:${m}`, () => api.overview())]);
  }
})().then(
  () => 'ok',
  () => 'erreur',
);
const result = await Promise.race([preload, new Promise((r) => setTimeout(() => r('lent'), 4000))]);

const root = document.getElementById('root')!;
// Base injoignable : on garde la page pré-rendue (lisible) plutôt qu'un écran d'erreur.
if (result === 'erreur' && root.querySelector('.static') && !location.pathname.includes('/equipe')) {
  console.warn('Almanach : base injoignable, affichage de la version enregistrée de la page.');
} else {
  root.removeAttribute('data-static');
  createRoot(root).render(<App api={api} initialMember={member} />);
}
