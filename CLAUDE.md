# Almanach : consignes pour Claude

L’Almanach est le site des règles des modes de Tsuki UHC (https://docs-almanach.fr).
Les textes vivent dans la base Supabase du projet Tsuki ; ce dépôt contient le site et un miroir des pages publiques.
On répond et on écrit en français.

## Qui peut écrire

Chaque membre de l’équipe Tsuki peut faire écrire les docs de ses modes par son propre Claude. Il faut :
- être collaborateur de ce dépôt (Jules l’ajoute) ;
- avoir relié son compte GitHub dans l’Almanach (Espace équipe › Claude).

Les pages sont signées « Claude pour <pseudo> ». Si l’action « Contenu » échoue avec « n’est relié à aucun membre de Tsuki »,
la personne doit relier son compte GitHub dans l’Almanach puis relancer l’action (ou pousser à nouveau). Personne d’autre ne peut publier :
un fork ou une demande de fusion n’envoie rien.

## Écrire ou corriger une doc

1. Partir de la dernière version de la branche principale `claude/project-thread-jhto3d` (`git fetch` puis créer sa branche depuis elle),
   pour que les numéros `revision:` soient à jour.
2. Modifier ou créer un fichier dans `contenu/<espace>/` (un dossier par mode, un fichier `.md` par page).
3. Garder la ligne `revision:` de l’en-tête telle quelle : c’est la version en ligne sur laquelle le texte a été écrit.
4. Remplir `note:` avec une phrase courte sur ce qui change (elle apparaît dans les Nouveautés).
5. Pousser sur sa branche de travail (n’importe quelle branche de ce dépôt, par exemple celle que crée la session Claude).
   L’action « Contenu » envoie seulement les fichiers modifiés depuis le départ de la branche.

Résultat :
- si `revision` est égale à la version en ligne, la page est publiée tout de suite (signée « Claude » dans l’historique) ;
- sinon (quelqu’un a modifié la page sur le site entre-temps), le texte devient une **proposition** que l’équipe relit dans l’éditeur ; rien n’est écrasé ;
- `proposal: true` force une proposition même si la version est à jour (à utiliser pour tout changement de règle discutable) ;
- un nouveau fichier crée la page ; un nouveau dossier avec `_espace.md` crée l’espace ;
- une page n’est jamais supprimée depuis GitHub : `archived: true` la met à la corbeille.

Après l’envoi, le site est reconstruit automatiquement. Toutes les 15 minutes, l’action « Site » réécrit dans `contenu/`
de la branche principale les pages modifiées sur le site (avec leur nouvelle `revision`) : toujours repartir d’elle avant de modifier un fichier.
Pas besoin de fusionner sa branche : ce qui est publié revient tout seul dans la branche principale.

Nouveau mode (par exemple un mode du plugin commun TsukiUHC) : créer `contenu/<adresse>/_espace.md` avec `catalog_key`
(ligne du tableau des modes de Tsuki) et `mode_id` (id du mode dans le plugin), puis ses pages. Un espace créé depuis GitHub
est en ligne tout de suite ; mettre `published: false` dans `_espace.md` pour le garder hors ligne le temps de le relire.

Pack de textures d’un mode : déposer le zip dans `public/packs/<adresse-du-mode>/<Nom>.zip` (un seul zip par dossier).
Le bouton « Télécharger le pack » apparaît tout seul dans la fiche du mode, et le fichier répond sur
`https://docs-almanach.fr/packs/<adresse-du-mode>/<Nom>.zip` (adresse utilisable aussi comme pack du serveur).
Le site ne se construit que depuis la branche principale : un pack poussé sur une autre branche doit y être fusionné.

Les espaces et pages « Équipe » ne sont jamais dans ce dépôt (il est public) et ne peuvent pas être touchés depuis GitHub.

## En-têtes

`_espace.md` (seul l’en-tête compte) :

```
---
title: Naruto UHC V3
tagline: Une phrase d’accroche (300 caractères max).
kind: mode            # ou guide
icon: https://mc-heads.net/head/<texture>/128   # ou un pseudo Minecraft, ou un emoji
color: "#f59b42"
family: naruto        # même famille = sélecteur de versions
version_label: V3
universe: Naruto
credits: Yukan (doc Mineflex)
origin_url: https://…  # doc d’origine publique (pas de Google Docs)
mc_version: 1.8.9
command: /commande
players: 20 à 60
camps: [{"name":"Konoha","color":"#3fbf7f"},{"name":"Akatsuki","color":"#e5484d"}]
catalog_key: uhc-067   # ligne du catalogue Tsuki (statut du mode)
mode_id: naruto_v3     # id du mode dans TsukiUHC
position: 260
---
```

Page :

```
---
title: Rôles de Konoha
icon: 🍃
description: Une phrase pour la recherche et les aperçus Discord.
parent: roles          # adresse de la page parente (groupe ou page)
position: 2
revision: 4
note: Rééquilibrage de Kakashi
---
```

Groupe de menu : `kind: group` (pas de texte). Lien externe : `kind: link` + `link_url:`.

## Syntaxe des pages

Markdown classique (titres, listes, tableaux, gras, liens, images) plus :

```
:::info Titre facultatif          (aussi astuce, attention, danger)
Texte de l’encadré.
:::

:::role Itachi Uchiha {camp="Akatsuki" tete="Itachi"}
Une ligne de résumé (reprise dans la recherche et la liste des rôles).

- **Pouvoir** : …
:::

:::tabs
:::tab Version courte
…
:::
:::tab Détails
…
:::
:::

:::details Titre du dépliant
…
:::

::video https://youtu.be/…
::roles {camp="Akatsuki"}         liste automatique des rôles du mode
```

`tete` accepte un pseudo Minecraft ou une adresse d’image. Les liens vers une autre page du mode s’écrivent `./adresse-de-la-page`,
vers un autre mode `/adresse-du-mode/adresse-de-la-page`. Pas de HTML libre.

## Règles de contenu

- Ne jamais recopier une doc GitBook ou un site tiers : écrire nos propres textes, créditer les auteurs (`credits`) et lier la doc d’origine (`origin_url`).
- Un rôle = une carte `:::role`, avec son camp tel qu’écrit dans `camps` de l’espace.
- Pages courtes et lisibles en partie : une idée par section, les chiffres en gras.

## Développement

```
npm ci
npm run dev                      # site branché sur la vraie base
VITE_DEMO=1 npm run dev          # démo en mémoire (ou ?demo dans l’adresse)
npm test && npm run build
node scripts/sync-contenu.ts --tout --essai   # vérifier ce qui serait envoyé, sans rien envoyer
```

Base : projet Supabase « tsuki » (tables `docs_*`, migrations dans `supabase/migrations`).
Fonction `docs-sync` : `supabase/functions/docs-sync` (vérifie le jeton OIDC de l’action GitHub, aucun secret).
Ne jamais coller de jeton dans un fichier ou un message : les secrets vont dans Supabase ou GitHub.
