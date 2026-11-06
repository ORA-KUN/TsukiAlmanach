---
title: La confiance et le vote
description: Ce qui fait monter et baisser la confiance, ce qu'elle donne, les paliers de pouvoir, le vote secret et le Tournoi des Héros.
parent: regles
position: 1
revision: 1
---

Tout le monde a une confiance, méchants compris : **25** à l'annonce des rôles. Chacun voit la sienne en barre sur son scoreboard, à côté de son rang, et tout le monde voit celle des autres : sous le pseudo, dans le classement (`/thx classement` ou le bracelet) et dans le pied du Tab.

## Ce qui la fait monter

| Quand | Combien |
| --- | --- |
| Un joueur vote pour toi | **+6** |
| Tu élimines un joueur | **+10**, plus le quart de sa confiance |
| Tu abats un imposteur démasqué | **+25** |
| Tu accuses juste | **+20** |
| Tu abats une créature de la Peur | une part de **40** selon tes coups, **3** au minimum |
| Tu sauves une foule | **+3** par civil sauvé, **15** au plus |
| Tu atteins le premier une épave | **+12** |
| Tu détruis un projecteur | **+10** |
| Tu gagnes un duel | ce que perd l'autre |
| Ton héros finit sur le podium du Tournoi | **+8** |
| On t'accuse à tort | **+5** |
| Tu signes un contrat | **+10**, puis **+5** à chaque Tournoi |

## Ce qui la fait baisser

| Quand | Combien |
| --- | --- |
| Tu es démasqué | tout |
| Tu tues un de tes fans (scandale public) | la moitié |
| Un contrat casse à tes dépens | **25 %** |
| Tu perds un duel | **30 %**, **5** au minimum |
| Tu accuses à tort | **-15**, ou **-7** pour un Citoyen |
| Tu tues un civil (scandale public) | **-10** |
| Tu te dérobes à un défi | **-5** |
| Le joueur pour qui tu as voté est démasqué | **-5** |
| Le public oublie, à chaque Tournoi | un dixième |
| Un pouvoir te vise | selon le pouvoir |

## Ce qu'elle donne

- **Dégâts** : **+1 %** par tranche de **5** de confiance, **20 %** au plus.
- **Résistance** : **1 %** de dégâts en moins par tranche de **10**, **10 %** au plus.
- **Pouvoirs** : un pouvoir s'ouvre à un palier, sans rien coûter. Le jeu annonce chaque palier qui s'ouvre ou se ferme, et l'objet du pouvoir dit le sien.

| Rôles | Ce qui ouvre leurs paliers | Ce qui fait leurs dégâts et leur résistance |
| --- | --- | --- |
| Héros, X | **1**, **40** et **80** de confiance. À **0** : plus aucun pouvoir, et **10 %** de dégâts en moins | la confiance |
| Spotlight, Zero, héros corrompus | le premier toujours, puis **25** et **50** de Peur, **ou** **40** et **80** de confiance | le meilleur de la confiance et de la Peur |
| Agences | le premier toujours, puis **1** et **3** contrats signés dans tout le camp | la confiance |
| Loli, Big Johnny | ils ne doivent rien à la foi | rien |

:::attention Corruption
Un héros qui reste **60 s** à **0** de confiance alors que la Peur est à **30** ou plus bascule dans la Spotlight. Il garde ses pouvoirs, qui vivent désormais de la Peur.
:::

## Le vote

Chaque saison, chaque joueur en vie a un vote (**2** pour un Citoyen), à donner avec `/thx voter <joueur>` ou d'un clic gauche sur une tête dans le bracelet. Le vote est secret : la cible voit seulement qu'un fan a voté pour elle.

Voter engage les deux côtés :

- Si ton héros finit dans les trois premiers au Tournoi, tu gagnes **8** de confiance.
- Si ton héros te tue, pendant cette saison ou la suivante, c'est le **scandale** : il perd la moitié de sa confiance, et le serveur l'annonce avec son pseudo.
- Si ton héros est démasqué, tu perds **5** de confiance.
- Si ton héros vit de la peur, ton vote fait monter la Peur au Tournoi : le serveur annonce combien de votes sont allés à ces gens-là, sans dire qui.

## Le Tournoi des Héros

À la fin de chaque saison :

1. Le podium est annoncé, et le premier **tient le titre** : **2 coeurs** de plus tant qu'il le garde. Il le perd au Tournoi suivant s'il n'est plus premier, s'il est démasqué, ou à sa mort.
2. Les fans du podium touchent leur prime, et les contrats paient.
3. Le public oublie : tout le monde perd un dixième de sa confiance.
4. Chacun peut de nouveau voter et accuser, et la Spotlight reçoit ses projecteurs.

Les chemins de victoire par le titre sont publics : le serveur annonce quand un joueur a **3** titres (X gagne au quatrième), et quand un signataire tient le titre (les agences gagnent à **3**).
