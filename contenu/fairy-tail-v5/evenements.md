---
title: Événements
icon: 👑
description: Les 4 Rois d'Ishgar, le Conseil des Maîtres et ses votes, le Rôle Troll.
parent: regles
position: 4
revision: 0
note: Règles du Fairy Tail UHC V5, chiffres du plugin
---

Les deux premiers événements sont actifs par défaut ; le host peut les couper dans le menu du mode.

## Les 4 Rois d'Ishgar (50 min)

Quatre joueurs en vie des guildes de Fiore (Fairy Tail, Sabertooth, Blue Pegasus, Crime Sorcière, Lamia Scale) sont tirés au sort et annoncés à tous. Chacun gagne **2❤** ; Jera, s'il est couronné, gagne aussi **5 %** de résistance. Un Spriggan qui tue un Roi d'Ishgar gagne **5 %** de force.

## Le Conseil des Maîtres (1h30)

Les maîtres des guildes officielles se réunissent **5 min**, s'ils sont au moins **2** en vie :

| Guilde | Maître |
| --- | --- |
| Fairy Tail | Mavis, sinon Makarof, sinon Erza |
| Sabertooth | Sting |
| Blue Pegasus | Bob, sinon Ichiya |
| Lamia Scale | Leon |

Ils sont téléportés dans la salle du Conseil, invisibles, et parlent sans pseudo ni guilde avec `/ft conseil <message>`. Chacun peut repartir avec `/ft quitter`. Un sujet est tiré au hasard et voté avec `/ft vote oui|non` ; le résultat tombe au bout de **2 min**, et en cas d'égalité, un autre sujet est soumis.

| Sujet | Si le vote passe |
| --- | --- |
| Faces | la magie ne remonte plus et chacun en perd (voir [Magie et effets](./magie)) |
| Aetherion | **1 min** plus tard, une frappe à la position d'un joueur au hasard : **5❤** à **12 blocs** autour |
| E.N.D | le Livre d'E.N.D est détruit : Natsu ne peut plus devenir E.N.D |
| Dévoilement | il faut l'unanimité : le pseudo et le rôle d'un membre de Tartaros ou des Spriggans sont annoncés |
| Mald Gheel | pas de vote : Mald Gheel peut attaquer le Conseil (`/ft attaque`) |

Si Mald Gheel attaque et tombe au Conseil, il ne meurt pas : son pseudo est annoncé, il perd tous ses bonus et revient à **10❤**, et chaque maître en vie gagne **5 %** de force. Un maître tué pendant l'attaque, lui, meurt pour de bon.

## Le Rôle Troll (désactivé par défaut)

À l'annonce des rôles, tout le monde croit être Zeleph pendant **1 min**, avant de recevoir son vrai rôle.
