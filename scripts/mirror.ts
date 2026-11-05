// Recopie dans contenu/ ce qui a été publié sur le site (pages publiques seulement : le dépôt est public).
// Claude part ainsi toujours de la dernière version. Lancé par l'action site.yml quand la base a changé.
import { writeMirror } from './lib/contenu.ts';
import { snapshot } from './lib/rest.ts';

const snap = await snapshot();
const changed = writeMirror(snap.spaces, snap.pages);
console.log(changed.length ? `Miroir : ${changed.length} fichier(s) mis à jour.\n${changed.join('\n')}` : 'Miroir : rien à changer.');
