// Envoie à l'Almanach les fichiers de contenu/ modifiés par un push (action contenu.yml).
//   node scripts/sync-contenu.ts contenu/naruto/roles.md contenu/naruto/_espace.md …
//   node scripts/sync-contenu.ts --tout            (tout le dossier)
//   node scripts/sync-contenu.ts --depuis <commit>  (fichiers modifiés depuis ce commit, via git)
//   node scripts/sync-contenu.ts --essai …         (affiche l'envoi sans rien envoyer)
import { execFileSync } from 'node:child_process';
import { readContenu } from './lib/contenu.ts';
import { SUPABASE_URL } from './lib/rest.ts';

const args = process.argv.slice(2);
const dry = args.includes('--essai');
let all = args.includes('--tout');
const since = args.includes('--depuis') ? args[args.indexOf('--depuis') + 1] ?? '' : null;
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--depuis');
if (since !== null) {
  // Premier push d'une branche : on envoie tout.
  if (!/^[0-9a-f]{7,40}$/.test(since) || /^0+$/.test(since)) all = true;
  else files.push(...execFileSync('git', ['diff', '--name-only', '--diff-filter=AMR', since, 'HEAD', '--', 'contenu/'], { encoding: 'utf8' }).split('\n').filter(Boolean));
}
if (!all && !files.length) {
  console.log('Aucun fichier de contenu modifié.');
  process.exit(0);
}

const spaces = readContenu(all ? undefined : files);
const payload = { author: process.env.ALMANACH_AUTHOR || 'Claude', spaces };
const total = spaces.reduce((n, s) => n + s.pages.length, 0);
console.log(`${spaces.length} espace(s), ${total} page(s) à envoyer.`);
if (dry) {
  console.log(JSON.stringify(payload, (k, v) => (k === 'content' && typeof v === 'string' ? `${v.length} caractères` : v), 2));
  process.exit(0);
}

// Jeton OIDC de GitHub Actions : prouve à la fonction que l'envoi vient bien de ce dépôt et de cette action.
const reqUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const reqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!reqUrl || !reqToken) throw new Error('Jeton OIDC indisponible : ce script tourne dans GitHub Actions (permission id-token: write).');
const tok = await fetch(`${reqUrl}&audience=tsuki-almanach`, { headers: { Authorization: `Bearer ${reqToken}` } });
if (!tok.ok) throw new Error(`Jeton OIDC refusé : ${tok.status}`);
const { value } = (await tok.json()) as { value: string };

const res = await fetch(`${SUPABASE_URL}/functions/v1/docs-sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-GitHub-OIDC': value },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(text);
if (!res.ok) process.exit(1);
const report = JSON.parse(text) as { ignorees?: { page?: string; espace?: string; raison: string }[]; propositions?: number };
for (const i of report.ignorees ?? []) console.log(`::warning::${i.page ?? i.espace} : ${i.raison}`);
if (report.propositions) console.log(`::notice::${report.propositions} proposition(s) à relire dans l’espace équipe de l’Almanach.`);
