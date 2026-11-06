---
title: Règles
icon: 📜
kind: page
description: "Les règles du Fairy Tail UHC V4 sur une page : but du jeu, carte FTUMAP, calendrier, quêtes, événements, morts et victoire."
position: 1
revision: 0
note: Nouvelle page Règles, qui résume tout le mode
---

Chaque partie de cette page renvoie à sa page détaillée, rangée juste en dessous dans le menu.

:::info En 30 secondes
- À **20 min**, chaque joueur devient un mage de Fairy Tail, avec un camp et des pouvoirs : effets de potion, objets à clic droit et quelques commandes.
- Chaque guilde a sa base sur la carte **FTUMAP** ; la barre d'action indique toujours la direction et la distance de la sienne.
- **10 min** après les rôles, chacun reçoit une quête qui rapporte des pommes d'or.
- Un camp gagne quand il est le seul encore en vie.
:::

## Le but du jeu

**31** rôles sont répartis en **6** camps : Fairy Tail, Sabertooth, Blue Pegasus, Crime Sorcière, les démons de Tartaros, et deux Solitaires, Zeleph et Acnologia. Les joueurs en trop deviennent des **Membres de guilde**, sans pouvoir.

Un camp gagne quand ses membres sont les seuls en vie. Quelques rôles changent de camp en cours de partie : voir [Victoire et alliances](#victoire-et-alliances).

## La carte

La partie se joue sur **FTUMAP**, une carte fournie avec le plugin. Tartaros a sa base au centre (**0 / 0**) ; Fairy Tail, Sabertooth, Blue Pegasus et Crime Sorcière ont la leur aux quatre coins d'un carré de **400** blocs, à **200** blocs du centre sur chaque axe. Zeleph et Acnologia, sans base, connaissent celles des autres avec `/guilds`.

Les coordonnées de chaque base : [Déroulement d'une partie](./deroulement#la-carte).

## Le calendrier

Un épisode dure **20 minutes**.

| Temps | Ce qui se passe |
| --- | --- |
| 0:00 | Lancement sur FTUMAP : personne n'a encore de rôle |
| 20:00 | Annonce des rôles (le host peut changer l'heure) |
| 30:00 | Une quête pour chacun ; les 4 Rois d'Ishgar, si l'événement est actif |
| 1:10:00 | Fairy Heart : Mavis, si elle est en vie, prend sa puissance |

Les quêtes et Fairy Heart se comptent depuis l'annonce des rôles : **10 min** et **50 min** après. Le détail : [Déroulement d'une partie](./deroulement).

## Les quêtes

**10 min** après l'annonce des rôles, chaque joueur en vie reçoit **une** quête tirée au hasard, à réussir une fois : crafter un objet, enchanter un objet, ou tuer Zeleph ou Acnologia. Elle rapporte de **1** à **4** pommes d'or, ou Résistance I pour toute la partie.

Deux crafts sont propres au mode : le **Réceptacle** et le **sort d'indestructibilité**, qui rend incassable un casque ou un pantalon en fer porté. Pendant la partie, on ne peut pas crafter de canne à pêche, de sucre, de casque ni de jambières en diamant, de livre et plume, de bibliothèque ni de pomme de Notch.

Le détail des quêtes et des crafts : [Quêtes et événements](./quetes-et-evenements).

## Les événements

Deux événements, coupés par défaut, que le host active dans le menu Événements :

- **Les 4 Rois d'Ishgar** : au moment des quêtes, quatre joueurs en vie tirés au sort gagnent **2❤**.
- **Le Rôle Troll** : à l'annonce des rôles, tout le monde se croit Zeleph pendant **1 min**, avec Vitesse I et Force I.

## Les morts

- Une mort est annoncée **5 s** après, avec le pseudo, le rôle et le camp du mort. Il laisse une pomme d'or.
- Ultia a **10 s** pour ramener un mort ; Keith, **5 s** pour ramener dans Tartaros un joueur tué par un démon. Le stuff attend leur décision.
- Mavis ne meurt pas tout de suite : son cristal apparaît, et celui qui le casse décide de son sort.
- Deux joueurs liés par Meldy meurent ensemble.

## Victoire et alliances

| Qui | Gagne |
| --- | --- |
| Un camp | quand il est le seul en vie |
| Zeleph, Acnologia | chacun seul |
| Erza et Jellal | à deux, si Jellal choisit Erza |
| Mavis | avec Zeleph, si **2** membres de Fairy Tail meurent près d'elle (Fairy Destiny) |
| Natsu devenu E.N.D | seul, s'il accepte le pacte du Livre d'E.N.D |
| Minerva tuée par Kyoka, les morts ramenés par Keith | avec Tartaros |
| Tartaros | tout de suite, si un démon tue E.N.D après que Keith l'a ramené |

Les conditions de chaque cas : [Déroulement d'une partie](./deroulement#victoire).

## Pour bien débuter

:::astuce Les commandes à connaître
- `/ftckoimonrole` (ou `/monrole`) : revoir son rôle.
- `/compo` : la composition de la partie.
- `/ftlist` : les esprits de Lucy et de Yukino.
- `/guilds` : les bases de guilde, pour Zeleph, Acnologia et E.N.D.
:::

Les pouvoirs à objet s'utilisent d'un clic droit, et leur recharge s'affiche quand on les tient en main. Toutes les commandes sont dans [Commandes](./commandes), et les **31** rôles dans [la liste des rôles](./_roles).
