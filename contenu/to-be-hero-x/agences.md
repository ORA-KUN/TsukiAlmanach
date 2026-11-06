---
title: Agences
icon: https://mc-heads.net/head/268e3e3f39154a8976786b2eb6f79108b933fdb9be033ba6aebcaaafff18e3e3/128
description: "Les 8 rôles des Agences : Shand, Uncle Rock, Mickey, Miss J, Zhen, le Délégué de la Commission, Moon et l'Attaché de presse."
parent: roles
position: 2
revision: 1
---

**8 rôles**, **12 coeurs** chacun, et aucun pouvoir de combat. Leurs pouvoirs sont des commandes, qui s'ouvrent avec les contrats signés dans tout le camp : le premier toujours, le deuxième dès **1** contrat, le troisième dès **3**. Chacun connaît les trois patrons : Shand, Uncle Rock et Mickey.

Une agence touche **20 %** des gains de ses signataires, et **+2** à chaque Tournoi. Tout le camp tient **10** contrats au plus : voir [Contrats](./contrats). Les Agences gagnent quand un de leurs signataires, ou un de leurs membres, tient le titre **3** fois, ou quand il ne reste en vie que les agences et leurs signataires.

| Rôle | Enseigne | Contrats |
| --- | --- | --- |
| Shand | TREEMAN | **3** |
| Uncle Rock | Mighty Glory | **3** |
| Mickey | DOS | **3** |
| Miss J | TREEMAN | **1** |
| Zhen | DOS | **1** |
| Attaché de presse | FOMO | **1** |
| Délégué de la Commission, Moon | aucune | **0** |

:::role Shand {camp="Agences" tete="https://mc-heads.net/head/22b40bfedcf0285dbfe78c67dd6b76c5a23c9870aa8c8b9e8bc142d045c2c066/128"}
Patron de TREEMAN : Sérum de Peur · Expérience interdite.

- **Contrats** : **3**, sous l'enseigne TREEMAN.
- **Sérum de Peur** (dès **1** contrat, toutes les **5 min**) : `/thx serum <signataire>`. Il gagne Force I pendant **5 min**, mais perd **5** de confiance, et la Peur monte de **2**.
- **Expérience interdite** (dès **3** contrats, une fois) : `/thx ranimer <mort>`. Le mort revient près de lui, à la moitié de sa vie, et joue désormais pour les agences, sous contrat avec lui. Il faut une place libre parmi ses contrats.
:::

:::role Uncle Rock {camp="Agences" tete="https://mc-heads.net/head/7bb46715aa1e295722c38ec669c4915146501487c8fd257f6d5ecf6fe43df39c/128"}
Patron de Mighty Glory : Contrat d'assassinat · Étouffer l'affaire · Prochain Zero.

- **Contrats** : **3**, sous l'enseigne Mighty Glory.
- **Contrat d'assassinat** (toutes les **5 min**) : `/thx assassinat <joueur>`. Ses signataires et Ghostblade reçoivent son nom. Son tueur gagne **30** de confiance, et Rock **15**.
- **Étouffer l'affaire** (dès **1** contrat, toutes les **5 min**) : `/thx etouffer <signataire>`. Sa prochaine perte de confiance n'a pas lieu.
- **Prochain Zero** (dès **3** contrats, toutes les **10 min**) : `/thx zero <signataire>`. Force II et Résistance I pendant **1 min**, et la Peur monte de **5**.
- Connaît Ghostblade.
:::

:::role Mickey {camp="Agences" tete="https://mc-heads.net/head/a561b0d7898d0a8c3fa3f7fd4778a55d2f3a1f8f75559f1144dfbe02c50a1e1a/128"}
Patron de DOS : Buzz · Révélation · Nouvel ordre.

- **Contrats** : **3**, sous l'enseigne DOS.
- **Buzz** (toutes les **5 min**) : `/thx buzz <joueur> plus` ou `moins`. Il gagne ou perd **15** de confiance.
- **Révélation** (dès **1** contrat, toutes les **15 min**) : `/thx reveler <joueur>`. Son camp est annoncé à tous. Un membre de la Spotlight sous **40** de confiance tombe, démasqué ; au-dessus, il passe pour un héros.
- **Nouvel ordre** (dès **3** contrats) : son vote vaut **3** votes.
:::

:::role Miss J {camp="Agences" tete="https://mc-heads.net/head/e8ef1582fda41c6e9362aabcedc86b67ba7ccb57f348a30e4a67e5688f6929/128"}
TREEMAN : Image de marque · Liste des fans · Communiqué.

- **Contrats** : **1**, sous l'enseigne TREEMAN.
- **Image de marque** (une fois par saison) : `/thx image <joueur>`. Il gagne **10** de confiance.
- **Liste des fans** (toutes les **3 min**) : `/thx fans <joueur>`. Qui a voté pour lui pendant cette saison.
- **Communiqué** (dès **1** contrat, toutes les **5 min**) : `/thx communique <joueur>`. Sa prochaine perte de confiance n'a pas lieu.
- Connaît Nice et Shand.
:::

:::role Zhen {camp="Agences" tete="https://mc-heads.net/head/6e1898a3be71d74d8a087b9eb94683e1d0d157f56dffc88bffe200dde638c8f1/128"}
DOS : Enquête · Scoop · Archives.

- **Contrats** : **1**, sous l'enseigne DOS.
- **Enquête** (toutes les **4 min**) : `/thx enquete <joueur>`. Ses éliminations, ses titres, ses fans, s'il a un contrat, et les pouvoirs de Peur qu'on lui connaît.
- **Scoop** (dès **1** contrat, toutes les **8 min**) : `/thx scoop <joueur>`. Ses éliminations sont publiées, et il perd **5** de confiance par élimination, **25** au plus.
- **Archives** (dès **3** contrats, une fois) : `/thx archives <joueur>`. Son rôle.
- Connaît Mickey.
:::

:::role Délégué de la Commission {camp="Agences" tete="https://mc-heads.net/head/5a16963b6775da94e37da26d8aa3b7df2e7173d6a338fdb19ded774c945e50/128"}
Blâme · Menottes · Audit.

- **Contrats** : aucun.
- **Blâme** (toutes les **5 min**) : `/thx blame <joueur>`. Il perd **15** de confiance.
- **Menottes** (dès **1** contrat, toutes les **10 min**) : un joueur visé à **8 blocs** n'a plus de pouvoirs pendant **30 s**. C'est du métal alien : rien n'y échappe.
- **Audit** (dès **3** contrats, toutes les **10 min**) : `/thx audit <joueur>`. Même pendant l'engagement, son contrat tombe au bout des **3 min** de préavis, sans frais pour personne.
:::

:::role Moon {camp="Agences" tete="https://mc-heads.net/head/c7446c6572433010aaca0692068378f02d5f5c0ebe68844b0593e657fa3f0965/128"}
Fausse mort · Appel à l'aide.

- **Contrats** : aucun.
- **Fausse mort** (une fois) : un coup mortel l'annonce morte à tous. Elle disparaît **30 s**, sans dégâts, avec la moitié de sa vie, et reste **5 min** hors du classement.
- **Appel à l'aide** (toutes les **5 min**) : `/thx appel <joueur>`. Il reçoit sa position et la croit retenue. S'il arrive à **10 blocs** d'elle en moins de **90 s**, elle gagne **10** de confiance.
- Connaît Lin Ling.
:::

:::role Attaché de presse {camp="Agences" tete="https://mc-heads.net/head/8e6dd7dbe684d1a96536e5e423f9d281388c99e31adb2d83995aa487537ec0/128"}
FOMO : un communiqué de presse toutes les 5 minutes.

- **Contrats** : **1**, sous l'enseigne FOMO.
- **Communiqué de presse** (toutes les **5 min**) : `/thx presse <joueur>`. Il gagne **5** de confiance.
- **1** place par défaut, **30** au plus.
:::
