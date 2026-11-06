---
title: Contrats
description: "Les contrats des agences : l'offre, ce que gagne le signataire, l'engagement, le préavis et ce que coûte une rupture. 10 contrats au plus pour tout le camp."
parent: regles
position: 6
revision: 1
---

:::info 10 contrats au plus
Tout le camp des agences tient **10** contrats au plus. Au-delà, l'offre est refusée. Le compteur est public : `/thx contrats`, le pied du Tab, le bracelet, et le scoreboard des agences et des signataires.
:::

## L’offre

`/thx contrat <joueur>` : la cible voit l'enseigne de l'agence (TREEMAN, Mighty Glory, DOS ou FOMO), jamais un pseudo, et toutes les conditions. Elle a **30 s** pour répondre avec `/thx signer` ou `/thx decliner`, ou par un clic dans le chat.

- Si elle refuse, la même agence attend **5 min** avant de revenir.
- Une agence ne fait pas signer un autre membre de son camp.
- Chaque patron tient un nombre de contrats à lui : voir les [Agences](./agences).

## Le contrat

- Le signataire **garde son camp**, et gagne **aussi** avec les agences.
- **+10** de confiance à la signature, puis **+5** à chaque Tournoi.
- **20 %** de ses gains vont à l'agence, qui touche aussi **+2** à chaque Tournoi.
- `/thx moncontrat` le rappelle, et sa fiche de rôle aussi.
- X ne signe jamais. Zero peut signer, mais il ne gagne jamais avec les agences.

## La rupture : jamais tout de suite

- **Engagement** : pendant une saison entière après la signature, personne ne peut rompre.
- **Préavis** : ensuite, une rupture prend effet au bout de **3 min**. Le contrat continue pendant ce temps, sans prime.

| Qui rompt | Comment | Ce que ça coûte |
| --- | --- | --- |
| L'agence | `/thx resilier <joueur>` | **-15** pour elle tout de suite, **-25 %** pour le signataire à la fin du préavis |
| Le signataire | `/thx rompre` | **-25 %** pour lui à la fin du préavis, versés à l'agence |
| La Commission | `/thx audit <joueur>` | rien, même pendant l'engagement, toujours avec le préavis |

Si l'agence meurt, le signataire est libre, sans frais. Un mort ranimé par Shand reste lié à lui : ce contrat-là ne se rompt pas.
