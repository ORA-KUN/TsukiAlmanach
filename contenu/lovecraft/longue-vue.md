---
title: Longue-vue, affinité et conversion
icon: 🔭
description: Lire la fiche d’un joueur, l’affinité avec les Anciens et la conversion.
parent: regles
position: 3
---

**Longue-vue.** Objet à crafter : 4 lingots d'or en croix autour d'une vitre. Clic droit en visant un joueur à 40 blocs ou moins : un menu ouvre sa fiche. Recharge : 5 minutes.

- Lignes de la fiche : rôle, camp, CON, DEX, INT, PER, POU, Folie, Ancien lié et affinité.
- Chaque ligne a 10 % de chance d'être lisible, +6 % par point de PER. Une ligne illisible s'affiche en caractères brouillés.
- Lire « Grand Ancien » sur la ligne camp donne +15 de Folie.
- Une cible avec 7 de PER ou plus sent qu'on l'observe (sans savoir qui).

**Affinité.** Chaque Humain a une affinité avec chaque Grand Ancien en jeu. À l'annonce des rôles, il reçoit un Ancien lié au hasard :

- 20 % de chance de commencer à 0 %.
- Sinon 5, 10, 15, 20, 25, 30, 35 ou 40 %, chaque palier à 10 % de chance.
- Les autres Anciens partent à 0 %.

L'affinité monte de +10 % à chaque prière ratée à l'autel de cet Ancien, et de +10 % tant qu'on porte son objet maudit (sauf l'Historien). Elle ne descend jamais, sauf l'objet relâché.

**Conversion.** Chaque Grand Ancien a une seule tentative par partie.

1. Quand il passe à 15 blocs ou moins d'un Humain qui a 30 % ou plus d'affinité avec lui, il le voit dans sa barre d'action.
2. Il tape `/l convertir <joueur>` à 15 blocs ou moins.
3. Si la cible a 6 de POU ou plus, rien ne se passe et la tentative n'est pas consommée (« son esprit est trop fort »).
4. Sinon, chance de réussite = l'affinité de la cible avec cet Ancien.
5. Réussite : la cible devient Convertie (camp des Grands Anciens), voit la liste des Anciens et rejoint leur chat de nuit. Sa Folie retombe à 0.
6. Échec : la cible reçoit +20 de Folie et apprend quel Ancien a voulu la prendre (le nom du dieu, pas le pseudo).
