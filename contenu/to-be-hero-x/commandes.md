---
title: Commandes
icon: https://mc-heads.net/head/cbbc06a8d6b1492e40f0e7c3b632b6fd8e66dc45c15234990caa5410ac3ac3fd/128
description: "Les commandes /thx et /duel, le bracelet, les commandes des agences et les réglages de l'host."
position: 3
revision: 0
note: Première fiche du mode, chiffres du plugin
---

Tout passe par `/thx` (alias `/tbhx`, `/tobeherox`), sauf les défis, qui ont aussi `/duel`. Les pouvoirs des Héros, de la Spotlight et des Solitaires s'utilisent d'un clic droit sur leur objet ; ceux des agences sont des commandes.

## Pour tout le monde

| Commande | Effet |
| --- | --- |
| `/thx role` | Ta fiche, tes pouvoirs et leurs paliers. `/role` y mène aussi |
| `/thx regles` | Le mode en quelques lignes |
| `/thx classement` | Le classement en têtes, comme le bracelet |
| `/thx voter <joueur>` | Ton vote secret de la saison |
| `/duel <joueur>` | Défier plus haut que soi ; `/duel accepter` ou `/duel refuser` pour répondre |
| `/thx accuser <joueur>` | Accuser quelqu'un de vivre de la Peur, devant tout le monde |
| `/thx crise` | Où est la crise en cours, et quand vient la prochaine |
| `/thx peur` | La jauge, les projecteurs allumés et la Chute |
| `/thx compo` | La composition, si l'host l'a rendue visible |

`/thx defi`, `/thx accepter` et `/thx refuser` marchent aussi pour les défis.

## Le bracelet

L'objet que chacun reçoit à l'annonce des rôles ouvre le classement en têtes :

- **clic gauche** sur une tête : voter pour ce joueur ;
- **clic droit** : le défier ;
- **Maj + clic** : l'accuser.

## Contrats

| Commande | Qui | Effet |
| --- | --- | --- |
| `/thx signer`, `/thx decliner` | La cible | Répondre à une offre, dans les **30 s** |
| `/thx moncontrat` | Un signataire | Revoir son contrat |
| `/thx rompre` | Un signataire | Rompre, après l'engagement, avec le préavis |
| `/thx contrats` | Tout le monde | Le compteur du camp, et ses signataires pour une agence |
| `/thx contrat <joueur>` | Une agence qui fait signer | Proposer un contrat |
| `/thx resilier <joueur>` | Une agence qui fait signer | Rompre un contrat, après l'engagement |

## Commandes des agences

| Commande | Rôle |
| --- | --- |
| `/thx serum <signataire>`, `/thx ranimer <mort>` | Shand |
| `/thx assassinat <joueur>`, `/thx etouffer <signataire>`, `/thx zero <signataire>` | Uncle Rock |
| `/thx buzz <joueur> plus` ou `moins`, `/thx reveler <joueur>` | Mickey |
| `/thx image <joueur>`, `/thx fans <joueur>`, `/thx communique <joueur>` | Miss J |
| `/thx enquete <joueur>`, `/thx scoop <joueur>`, `/thx archives <joueur>` | Zhen |
| `/thx blame <joueur>`, `/thx audit <joueur>` | Délégué de la Commission |
| `/thx appel <joueur>` | Moon |
| `/thx presse <joueur>` | Attaché de presse |

## Réglages de l’host

Dans la composition du mode : le nombre de chaque rôle (**30** au plus pour le Citoyen, le Sbire et l'Attaché de presse, **1** pour les autres), la composition visible ou non, et la durée d'une saison, de **5** à **30 min** (**15** par défaut). Il faut au moins autant de places que de joueurs, sinon le lancement est refusé.
