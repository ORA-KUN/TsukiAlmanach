import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, parseInfo } from '../src/lib/markdown.ts';
import { slugify } from '../src/lib/slug.ts';

test('slug sans accents, identique à la base', () => {
  assert.equal(slugify("Les rôles de l'Akatsuki"), 'les-roles-de-l-akatsuki');
  assert.equal(slugify('Cœur — Œuvre'), 'coeur-oeuvre');
});

test('en-tête de bloc : libellé et attributs', () => {
  const i = parseInfo('role', ' Itachi Uchiha {camp="Akatsuki" tête="Itachi"}');
  assert.equal(i.label, 'Itachi Uchiha');
  assert.deepEqual(i.attrs, { camp: 'Akatsuki', tete: 'Itachi' });
  assert.equal(parseInfo('role', '[Kisame]{camp="Akatsuki"}').label, 'Kisame');
});

test('encadrés, rôles, onglets, dépliants, vidéo', () => {
  const src = [
    '## Règles du jeu', '', ':::attention Piège', 'Ne pas **tomber**.', ':::', '',
    ':::role Itachi Uchiha {camp="Akatsuki" tete="Itachi"}', 'Voit le rôle d’un joueur.', ':::', '',
    '::::tabs', ':::tab Classique', 'Texte A', ':::', ':::tab Rapide', 'Texte B', ':::', '::::', '',
    ':::details Pour aller plus loin', 'Caché', ':::', '', '::video https://youtu.be/dQw4w9WgXcQ', '',
    '- [x] fait', '- [ ] à faire', '', '[page](/naruto/akatsuki) [ext](https://example.com) [rel](./roles)',
    '', '<script>alert(1)</script>',
  ].join('\n');
  const r = renderMarkdown(src, { base: '/TsukiAlmanach', space: 'naruto', camps: [{ name: 'Akatsuki', color: '#c0392b' }] });
  assert.match(r.html, /<h2 id="regles-du-jeu">/);
  assert.match(r.html, /class="callout callout--attention"/);
  assert.match(r.html, /<p class="callout__title">Piège<\/p>/);
  assert.match(r.html, /<section class="role" id="role-itachi-uchiha" style="--camp:#c0392b"/);
  assert.match(r.html, /mc-heads\.net\/avatar\/Itachi\/64/);
  assert.match(r.html, /role="tab"[^>]*aria-selected="true"[^>]*>Classique/);
  assert.match(r.html, /data-panel="1" hidden/);
  assert.match(r.html, /<details class="fold"><summary>Pour aller plus loin<\/summary>/);
  assert.match(r.html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(r.html, /class="task"/);
  assert.match(r.html, /task__box--done/);
  assert.match(r.html, /href="\/TsukiAlmanach\/naruto\/akatsuki" data-internal/);
  assert.match(r.html, /href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer"/);
  assert.match(r.html, /href="\/TsukiAlmanach\/naruto\/roles" data-internal/);
  assert.doesNotMatch(r.html, /<script>/);
  assert.deepEqual(r.roles.map((x) => x.anchor), ['role-itachi-uchiha']);
  assert.deepEqual(r.headings.map((h) => h.id), ['regles-du-jeu', 'role-itachi-uchiha']);
});

test('blocs imbriqués avec le même nombre de « : »', () => {
  const src = [':::details Plus', ':::info', 'Dedans', ':::', 'Après', ':::', 'Hors bloc'].join('\n');
  const r = renderMarkdown(src);
  assert.match(r.html, /<details class="fold"><summary>Plus<\/summary><div class="fold__body"><aside class="callout callout--info">/);
  assert.match(r.html, /<p>Après<\/p>\n<\/div><\/details>\n<p>Hors bloc<\/p>/);
});

test('un bloc inconnu reste du texte, un bloc non fermé va jusqu’au bout', () => {
  assert.match(renderMarkdown(':::inconnu\nx\n:::').html, /<p>:::inconnu/);
  assert.match(renderMarkdown(':::info\nTexte').html, /callout--info[\s\S]*Texte/);
});

test('liste des rôles de l’espace', () => {
  const r = renderMarkdown('::roles {camp="Akatsuki"}', { base: '', space: 'n', roles: [
    { name: 'Itachi', camp: 'Akatsuki', head: 'Itachi', anchor: 'role-itachi', summary: '', page: 'akatsuki' },
    { name: 'Naruto', camp: 'Konoha', head: '', anchor: 'role-naruto', summary: '', page: 'konoha' },
  ] });
  assert.match(r.html, /href="\/n\/akatsuki#role-itachi"/);
  assert.doesNotMatch(r.html, /Naruto/);
});
