---
title: Peur et projecteurs
description: "L'Indice de Peur, ce qui le fait monter et baisser, ses seuils jusqu'à la Chute, et les projecteurs de la Spotlight."
parent: regles
position: 4
revision: 0
note: Première fiche du mode, chiffres du plugin
---

L'Indice de Peur est une jauge publique de **0** à **100** : sur le scoreboard, dans le Tab et avec `/thx peur`.

## Ce qui la fait monter

| Quand | Combien |
| --- | --- |
| Un projecteur allumé | **+1** par minute, chacun |
| Un imposteur tient le titre | **+1** par minute |
| Un vote pour quelqu'un qui vit de la peur | **+1** au Tournoi |
| Une mort | **+3**, ou **+6** pour un joueur du podium |
| Un civil tué | **+3** |
| Un héros tue un de ses fans | **+5** |
| Une crise ratée | **+8** (créature, foule), **+4** (épave), **+3** (foule sauvée sans aucun héros) |

## Ce qui la fait baisser

| Quand | Combien |
| --- | --- |
| Un membre de la Spotlight meurt | **-8** |
| La créature de la Peur est abattue | **-8** |
| Quelqu'un est démasqué | **-5** |
| L'épave est atteinte | **-4** |
| Un projecteur est détruit | **-3** |
| La foule est sauvée | **-1** par civil |
| Rien ne la nourrit | **-1** par minute |

## Les seuils

- **25** : la Spotlight devient plus forte, et ses deuxièmes pouvoirs s'ouvrent.
- **50, la panique** : les gains de confiance baissent d'un quart, sauf pour ceux qui vivent de la peur. Les troisièmes pouvoirs de la Spotlight s'ouvrent.
- **100, la Chute** : tous les projecteurs sont révélés, et un compte à rebours de **5 min** commence. S'il va à son terme, la Spotlight gagne, ou Zero s'il vit encore. Il s'arrête si la Peur retombe sous **80**.

## Les projecteurs

Chaque membre de la Spotlight reçoit un projecteur à l'annonce des rôles puis à chaque Tournoi, deux pour le chef. Il se pose comme un bloc, sur la map.

- **6** projecteurs au plus peuvent être allumés en même temps.
- Au bout d'**1 min**, la position d'un projecteur est annoncée à tous, et une colonne de flammes le signale.
- N'importe qui peut le casser. Un joueur hors de la Spotlight gagne alors **10** de confiance, et la Peur baisse de **3**.
- Le Court-circuit d'E-Soul détruit ceux qui sont à **20 blocs**.
