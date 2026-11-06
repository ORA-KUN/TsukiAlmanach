# Almanach

Les règles des modes UHC de Tsuki, lisibles en partie : recherche instantanée des rôles, cartes de rôle, versions,
nouveautés, thème jour et nuit. Site : https://docs-almanach.fr

- **Joueurs** : tout est public, rien à installer.
- **Équipe Tsuki** : bouton « Équipe » en haut à droite, même compte que l’application Tsuki. Éditeur avec aperçu en direct,
  brouillons, historique et restauration, propositions de Claude à relire, plan des espaces, statistiques.
- **Claude** : écrit dans `contenu/` et pousse ; voir [CLAUDE.md](CLAUDE.md).

Construit avec Vite, React et Supabase (base partagée avec Tsuki et TsukiBot). Chaque page est pré-rendue pour les aperçus
Discord, Google et les assistants (`llms.txt`).
