// Tests de la base de l'Almanach (Tsuki Docs) : un vrai Postgres en mémoire (PGlite) avec le schéma de Tsuki
// (dépôt ORA-KUN/Tsuki cloné à côté : ../tsuki) puis supabase/migrations/docs_*.sql.
// Lancer : npm run test:base
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import fs from 'node:fs';
import path from 'node:path';

const TSUKI = process.env.TSUKI_DIR ?? new URL('../../tsuki/', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto, unaccent, pg_trgm } });
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.log('  ✗', label); } };
const expectError = async (fn, label, re) => {
  try { await fn(); fail++; console.log('  ✗', label, '(aucune erreur)'); }
  catch (e) { const good = !re || re.test(e.message); good ? pass++ : fail++; console.log(good ? '  ✓' : '  ✗', label, '→', e.message.slice(0, 90)); }
};
const as = async (id) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id ?? ''}', false); set role ${id ? 'authenticated' : 'anon'};`); };
const su = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); };
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
const signup = async (email, meta) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)]))[0].id;

await db.exec(`
  create schema extensions; create extension pgcrypto schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}', encrypted_password text, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert on storage.objects to authenticated;
`);
for (const f of ['migrations/0001_init.sql', 'seed.sql', 'migrations/0002_uhcall_sync.sql', 'migrations/0003_uhcall_nom.sql',
  'migrations/0004_doc_url.sql', 'migrations/0005_cdc.sql']) {
  await db.exec(fs.readFileSync(path.join(TSUKI, 'supabase', f), 'utf8'));
}
const migDir = new URL('../supabase/migrations/', import.meta.url).pathname;
const migs = fs.readdirSync(migDir).filter((f) => /^docs_.*\.sql$/.test(f)).sort();
for (const f of migs) {
  const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(sql.replace(/--.*$/gm, '')), `${f} : aucune instruction destructive (sinon le connecteur Supabase demande une confirmation)`);
  await db.exec(sql);
  await db.exec(sql); // rejouable
}
console.log('Schéma chargé :', migs.join(', '));

// Comptes : Jules (admin), Bob (membre), Eve (profil forgé sans invitation).
await q(`insert into invitations (email, code, role) values ('jules@x.fr', 'ABCD-EFGH', 'admin'), ('bob@x.fr', 'BOBB-1234', 'membre')`);
const jules = await signup('jules@x.fr', { pseudo: 'ORA', invite: 'ABCD-EFGH' });
const bob = await signup('bob@x.fr', { pseudo: 'Bob', invite: 'BOBB-1234' });
await db.exec(`set session_replication_role = replica;`);
const eve = (await one(`insert into auth.users (email) values ('eve@x.fr') returning id`)).id;
await q(`insert into profiles (id, pseudo, role, approved) values ($1, 'Eve', 'admin', true)`, [eve]);
await db.exec(`set session_replication_role = origin;`);

console.log('\n1. Espaces');
await as(bob);
const sp = (await one(`insert into docs_spaces (slug, title, catalog_key, camps) values ('naruto-v3', 'Naruto UHC V3', 'uhc-067', '[{"name":"Akatsuki","color":"#c0392b"}]') returning id, published, created_by`));
ok(sp.created_by === bob && !sp.published, 'un membre crée un espace (hors ligne), signé à son nom');
await expectError(() => q(`update docs_spaces set published = true where id = $1`, [sp.id]), 'un membre ne peut pas le mettre en ligne', /Seul un admin/);
await expectError(() => q(`insert into docs_spaces (slug, title, published) values ('pirate', 'Pirate', true)`), 'ni créer un espace déjà en ligne', /Seul un admin/);
await expectError(() => q(`insert into docs_spaces (slug, title) values ('equipe', 'Réservé')`), 'les adresses réservées du site sont refusées', /check/);
await as(null);
ok((await q(`select * from docs_spaces`)).length === 0, 'un visiteur ne voit pas un espace hors ligne');
await expectError(() => q(`insert into docs_spaces (slug, title) values ('x', 'X')`), 'un visiteur ne peut rien créer', /permission denied/);
await as(eve);
await expectError(() => q(`insert into docs_spaces (slug, title) values ('eve', 'Eve')`), 'un profil forgé sans invitation non plus', /row-level security/);

console.log('\n2. Pages, brouillons et publication');
await as(bob);
const pid = (await one(`select docs_create_page($1, null, 'Les rôles de l''Akatsuki') id`, [sp.id])).id;
const p0 = await one(`select slug, revision, published_at from docs_pages where id = $1`, [pid]);
ok(p0.slug === 'les-roles-de-l-akatsuki' && p0.revision === 0 && p0.published_at === null, 'nouvelle page : slug sans accents, pas encore publiée');
const pid2 = (await one(`select docs_create_page($1, null, 'Les rôles de l''Akatsuki') id`, [sp.id])).id;
ok((await one(`select slug from docs_pages where id = $1`, [pid2])).slug === 'les-roles-de-l-akatsuki-2', 'même titre : slug numéroté');
const content = [
  '## Akatsuki', '', ':::info Bon à savoir', 'Les membres se reconnaissent.', ':::', '',
  ':::role Itachi Uchiha {camp="Akatsuki" tete="Itachi"}', 'Peut voir le **rôle** d’un joueur une fois par épisode.', '', 'Objectif : gagner avec l’Akatsuki.', ':::', '',
  ':::role[Kisame]{camp="Akatsuki"}', ':::', '', ':::role Itachi Uchiha {camp="Solo"}', 'Variante.', ':::',
].join('\n');
await q(`select docs_save_draft($1, 'Akatsuki', 'Les rôles du camp Akatsuki', '🔴', $2, 0)`, [pid, content]);
await as(null);
await expectError(() => q(`select * from docs_drafts`), 'un visiteur ne lit pas les brouillons', /permission denied/);
ok((await q(`select id, title from docs_pages`)).length === 0, 'ni les pages non publiées');
await as(bob);
ok((await one(`select content from docs_drafts where page_id = $1`, [pid])).content === content, 'le membre retrouve son brouillon');
const rev1 = (await one(`select docs_publish($1, 'Akatsuki', 'Les rôles du camp Akatsuki', '🔴', $2, 'Première version', 0) r`, [pid, content])).r;
ok(rev1 === 1, 'publication : révision 1');
const p1 = await one(`select revision, published_at, roles, updated_by from docs_pages where id = $1`, [pid]);
ok(p1.published_at !== null && p1.updated_by === bob, 'la page est publiée, signée par Bob');
ok(p1.roles.length === 3 && p1.roles[0].name === 'Itachi Uchiha' && p1.roles[0].camp === 'Akatsuki' && p1.roles[0].head === 'Itachi'
  && p1.roles[0].anchor === 'role-itachi-uchiha', 'cartes de rôle lues : nom, camp, tête, ancre');
ok(p1.roles[0].summary.startsWith('Peut voir le rôle'), 'résumé du rôle = première ligne, sans Markdown');
ok(p1.roles[1].name === 'Kisame' && p1.roles[1].summary === '', 'syntaxe :::role[Nom]{…} comprise');
ok(p1.roles[2].anchor === 'role-itachi-uchiha-2', 'deux rôles du même nom : ancres distinctes');
ok((await one(`select content from docs_drafts where page_id = $1`, [pid])).content === null, 'le brouillon est vidé après publication');
const h = await q(`select revision, author_label, note, source from docs_revisions where page_id = $1`, [pid]);
ok(h.length === 1 && h[0].author_label === 'Bob' && h[0].note === 'Première version', 'historique : version 1 par Bob avec sa note');
const act = await one(`select actor_id, action, label from activity where entity = 'docs_pages' order by created_at desc limit 1`);
ok(act && act.actor_id === bob && act.action === 'cree' && act.label.includes('Naruto UHC V3 › Akatsuki'), 'le journal de Tsuki montre la publication');
await expectError(() => q(`select docs_publish($1, 'Akatsuki', '', '', 'version périmée', 'x', 0)`, [pid]), 'publier sur une version périmée : conflit', /conflit:1/);
const rev2 = (await one(`select docs_publish($1, 'Akatsuki', 'Les rôles du camp Akatsuki', '🔴', $2, '', 1) r`, [pid, content + '\n\nAjout.'])).r;
ok(rev2 === 2, 'publication suivante sur la bonne base : révision 2');
await expectError(() => q(`update docs_pages set content = 'pirate' where id = $1`, [pid]), 'le texte ne change jamais en direct (seulement par publication)', /permission denied/);
await expectError(() => q(`update docs_pages set revision = 99 where id = $1`, [pid]), 'ni le numéro de révision', /permission denied/);
await q(`update docs_pages set title = 'Camp Akatsuki', icon = '☁️', position = 5 where id = $1`, [pid]);
ok((await one(`select title from docs_pages where id = $1`, [pid])).title === 'Camp Akatsuki', 'renommer, changer l’icône, réordonner : direct');
const r3 = (await one(`select docs_restore($1, 1) r`, [pid])).r;
const p3 = await one(`select revision, content from docs_pages where id = $1`, [pid]);
ok(r3 === 3 && p3.content === content, 'restaurer la version 1 crée la version 3 avec l’ancien texte');
ok((await one(`select source, note from docs_revisions where page_id = $1 and revision = 3`, [pid])).note === 'Retour à la version 1', 'la restauration est notée dans l’historique');

console.log('\n3. Arbre et corbeille');
const child = (await one(`select docs_create_page($1, $2, 'Itachi en détail') id`, [sp.id, pid])).id;
const grand = (await one(`select docs_create_page($1, $2, 'Sharingan') id`, [sp.id, child])).id;
await expectError(() => q(`update docs_pages set parent_id = $1 where id = $2`, [grand, pid]), 'impossible de ranger une page dans sa propre sous-page', /sous-pages/);
await expectError(() => q(`update docs_pages set parent_id = $1 where id = $1`, [pid]), 'ni dans elle-même', /propre parente/);
await q(`update docs_pages set archived = true where id = $1`, [pid]);
ok((await q(`select id from docs_pages where id in ($1, $2) and archived`, [child, grand])).length === 2, 'mettre une page à la corbeille y met ses sous-pages');
await q(`update docs_pages set archived = false where id = $1`, [pid]);
ok((await q(`select id from docs_pages where id in ($1, $2) and not archived`, [child, grand])).length === 2, 'et l’en sortir les ressort');
const grp = (await one(`select docs_create_page($1, null, 'Règles', 'group') id`, [sp.id])).id;
ok((await one(`select published_at from docs_pages where id = $1`, [grp])).published_at !== null, 'un groupe de menu est visible tout de suite');

console.log('\n4. Lecture publique');
await as(jules);
await q(`update docs_spaces set published = true where id = $1`, [sp.id]);
await as(null);
const pub = await q(`select id, title from docs_pages order by position`);
ok(pub.some((r) => r.id === pid) && !pub.some((r) => r.id === child), 'espace en ligne : un visiteur voit les pages publiées, pas les autres');
await expectError(() => q(`select search, created_by from docs_pages`), 'colonnes internes cachées aux visiteurs', /permission denied/);
await expectError(() => q(`select * from docs_revisions`), 'historique réservé à l’équipe', /permission denied/);
await expectError(() => q(`update docs_pages set title = 'pirate'`), 'un visiteur ne modifie rien', /permission denied/);
await as(bob);
await q(`update docs_pages set visibility = 'equipe' where id = $1`, [pid2]);
await q(`select docs_publish($1, 'Secret', '', '', 'Stratégie secrète de l''équipe', '', 0)`, [pid2]);
await as(null);
ok(!(await q(`select id from docs_pages`)).some((r) => r.id === pid2), 'une page « Équipe » reste invisible des visiteurs');

console.log('\n5. Recherche');
await as(null);
let res = await q(`select * from docs_search('itachi')`);
ok(res[0]?.kind === 'role' && res[0].title === 'Itachi Uchiha' && res[0].anchor === 'role-itachi-uchiha', 'un rôle est trouvé en premier, avec son ancre');
ok(res.some((r) => r.kind === 'page' && r.page_id === pid), 'la page qui le contient aussi');
res = await q(`select * from docs_search('akatsu')`);
ok(res.some((r) => r.page_id === pid), 'recherche pendant la frappe (début de mot)');
res = await q(`select * from docs_search('episode')`);
ok(res.some((r) => r.page_id === pid && /«/.test(r.snippet)), 'sans accents, avec un extrait surligné');
res = await q(`select * from docs_search('strategie secrete')`);
ok(res.length === 0, 'un visiteur ne trouve pas les pages « Équipe »');
await as(bob);
res = await q(`select * from docs_search('strategie secrete')`);
ok(res.some((r) => r.page_id === pid2), 'un membre, si');
res = await q(`select * from docs_search('Akatsku')`);
ok(res.some((r) => r.page_id === pid), 'une faute de frappe dans un titre passe quand même');

console.log('\n6. Statistiques, nouveautés, statut');
await as(null);
await q(`select docs_hit($1)`, [pid]); await q(`select docs_hit($1)`, [pid]); await q(`select docs_vote($1, true)`, [pid]);
await q(`select docs_hit($1)`, [pid2]);
await expectError(() => q(`select * from docs_stats`), 'statistiques réservées à l’équipe', /permission denied/);
const cl = await q(`select * from docs_changelog(10)`);
ok(cl.length >= 1 && cl[0].author_label === '' && cl.every((r) => r.page_title !== 'Secret'), 'nouveautés publiques, sans les noms de l’équipe ni les pages privées');
const st = await q(`select * from docs_space_status()`);
ok(st.length === 1 && st[0].space_id === sp.id && typeof st[0].status === 'string', 'statut du mode lu dans le tableau de Tsuki');
ok((await one(`select docs_last_change() t`)).t !== null, 'date de dernière modification visible');
await as(bob);
const s1 = await one(`select views, up, down from docs_stats where page_id = $1`, [pid]);
ok(s1.views === 2 && s1.up === 1 && s1.down === 0, 'l’équipe voit 2 vues et 1 vote utile');
ok((await q(`select * from docs_stats where page_id = $1`, [pid2])).length === 0, 'une page privée ne compte pas de vues publiques');

console.log('\n7. Lien avec le tableau des modes');
await su();
const before = await one(`select doc_url, doc from catalog where seed_key = 'uhc-067'`);
ok((await one(`select doc_url from catalog where seed_key = 'uhc-067'`)).doc_url === before.doc_url, 'tant que le réglage est coupé, la coche Doc ne bouge pas');
await as(bob);
await q(`update docs_settings set link_catalog = true`);
ok((await one(`select link_catalog from docs_settings`)).link_catalog === false, 'seul un admin active le lien');
await as(jules);
await q(`update docs_settings set link_catalog = true`);
const n = (await one(`select docs_link_all() n`)).n;
const after = await one(`select doc_url, doc from catalog where seed_key = 'uhc-067'`);
ok(n === 1 && after.doc_url === 'https://ora-kun.github.io/TsukiAlmanach/naruto-v3/', 'la coche Doc ouvre la page Tsuki Docs du mode');
ok(!before.doc_url || (after.doc ?? '').includes(before.doc_url), 'l’ancien lien est gardé dans les remarques du mode');
ok(!before.doc_url || (await one(`select origin_url from docs_spaces where id = $1`, [sp.id])).origin_url === before.doc_url, 'et comme « doc d’origine » de l’espace');

console.log('\n8. Images');
await as(bob);
await q(`insert into storage.objects (bucket_id, name) values ('docs', 'naruto/itachi.png')`);
ok(true, 'un membre ajoute une image');
await as(eve);
await expectError(() => q(`insert into storage.objects (bucket_id, name) values ('docs', 'pirate.png')`), 'un profil forgé, non', /row-level security/);
await su();
ok((await one(`select public, allowed_mime_types from storage.buckets where id = 'docs'`)).allowed_mime_types.includes('image/png'), 'seau public « docs » limité aux images');


console.log('\n10. Aperçu');
await as(null);
const ov = await q(`select * from docs_overview()`);
ok(ov.length === 1 && ov[0].space_id === sp.id && ov[0].roles >= 3, 'aperçu public : pages et rôles de l’espace en ligne');
await su();
ok((await one(`select docs_slugify(repeat('a', 59) || ' b') s`)).s === 'a'.repeat(59), 'slug coupé sans tiret final');

console.log('\n9. Synchro depuis GitHub (Claude)');
await su();
const gs = (body) => one(`select docs_git_sync($1::jsonb) r`, [JSON.stringify(body)]).then((x) => x.r);
let rep = await gs({ author: 'Claude', spaces: [{ slug: 'lovecraft', meta: { title: 'Lovecraft UHC', icon: '🐙', camps: [{ name: 'Investigateurs', color: '#4a90d9' }] },
  pages: [
    { slug: 'regles', kind: 'group', title: 'Règles', position: 1 },
    { slug: 'presentation', title: 'Présentation', parent: 'regles', position: 1, description: 'Le mode en bref', content: '## Le mode\n\nUn mode original de Jules.' },
    { slug: 'cthulhu', title: 'Cthulhu', parent: 'regles', position: 2, content: ':::role Cthulhu {camp="Grands Anciens"}\nSe réveille à l’épisode 6.\n:::' },
  ] }] });
ok(rep.espaces_crees === 1 && rep.pages_creees === 3 && rep.publiees === 2, 'un nouvel espace et ses pages arrivent publiés');
const lv = await one(`select id, published, camps from docs_spaces where slug = 'lovecraft'`);
const pres = await one(`select id, parent_id, revision, published_at from docs_pages where space_id = $1 and slug = 'presentation'`, [lv.id]);
const grpL = await one(`select id from docs_pages where space_id = $1 and slug = 'regles'`, [lv.id]);
ok(lv.published && lv.camps[0].name === 'Investigateurs' && pres.parent_id === grpL.id && pres.revision === 1, 'arbre, camps et révision corrects');
ok((await one(`select author_label, source from docs_revisions where page_id = $1`, [pres.id])).author_label === 'Claude', 'l’historique signe « Claude »');
rep = await gs({ spaces: [{ slug: 'lovecraft', pages: [{ slug: 'presentation', title: 'Présentation', description: 'Le mode en bref', revision: 1, content: '## Le mode\n\nUn mode original de Jules.' }] }] });
ok(rep.identiques === 1 && rep.publiees === 0, 'un fichier inchangé ne crée pas de version');
rep = await gs({ spaces: [{ slug: 'lovecraft', pages: [{ slug: 'presentation', title: 'Présentation', revision: 1, note: 'Ajout du déroulement', content: '## Le mode\n\nNouveau texte.' }] }] });
ok(rep.publiees === 1 && (await one(`select revision from docs_pages where id = $1`, [pres.id])).revision === 2, 'fichier parti de la dernière version : publié (version 2)');
await as(bob);
await q(`select docs_publish($1, 'Présentation', '', '', 'Texte de Bob', '', 2)`, [pres.id]);
await su();
rep = await gs({ spaces: [{ slug: 'lovecraft', pages: [{ slug: 'presentation', title: 'Présentation', revision: 2, content: 'Texte de Claude basé sur la v2' }] }] });
const dr = await one(`select content, source, author_label, base_revision from docs_drafts where page_id = $1`, [pres.id]);
ok(rep.propositions === 1 && dr.source === 'claude' && dr.content.startsWith('Texte de Claude') && dr.base_revision === 2, 'page modifiée sur le site entre-temps : la version de Claude devient une proposition');
ok((await one(`select content from docs_pages where id = $1`, [pres.id])).content === 'Texte de Bob', 'et le texte de Bob reste en ligne');
await as(bob);
await q(`select docs_save_draft($1, 'Présentation', '', '', 'Bob réécrit', 3)`, [pres.id]);
await su();
rep = await gs({ spaces: [{ slug: 'lovecraft', pages: [{ slug: 'presentation', title: 'Présentation', revision: 2, content: 'Encore Claude' }] }] });
ok(rep.ignorees.length === 1 && (await one(`select content from docs_drafts where page_id = $1`, [pres.id])).content === 'Bob réécrit', 'un brouillon en cours sur le site n’est jamais remplacé');
await as(jules);
await q(`update docs_spaces set visibility = 'equipe' where slug = 'lovecraft'`);
await su();
rep = await gs({ spaces: [{ slug: 'lovecraft', meta: { title: 'Pirate' } }] });
ok(rep.ignorees[0]?.espace === 'lovecraft' && (await one(`select title from docs_spaces where slug = 'lovecraft'`)).title === 'Lovecraft UHC', 'un espace « Équipe » n’est jamais touché depuis le dépôt public');
await as(bob);
await expectError(() => q(`select docs_git_sync('{"spaces":[]}'::jsonb)`), 'la synchro est réservée à la fonction docs-sync', /permission denied/);

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
