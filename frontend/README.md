# Front-end CIR (React)

Deux applications séparées, qui partagent le dossier `shared/` :

| Dossier | Application | Port |
|---|---|---|
| `site/` | site public : accueil (vidéo, sphère), catalogue, fiche produit, réalisations, compte, sélection, commandes, messagerie, contact | 5173 |
| `dashboard/` | tableau de bord de l'équipe : statistiques, commandes et négociation, messagerie, demandes, catalogue, clients, contenus | 5174 |
| `shared/` | couleurs et polices (`styles/`), client de l'API avec renouvellement du jeton (`api/client.js`), WebSocket avec reconnexion (`api/socket.js`), mise en forme FCFA / dates (`format.js`) | — |

## Commandes (dans `site/` ou `dashboard/`)

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances |
| `npm run dev` | serveur de développement |
| `npm run build` | version optimisée dans `dist/` |
| `npm run preview` | aperçu de la version optimisée |

Variable d'environnement : `VITE_API_URL` (adresse de l'API, `.env.local`).

## Conventions

- Un dossier par module fonctionnel dans `src/modules/` (voir `docs/architecture.md`).
- Styles : CSS Modules (`*.module.css`) pour le site ; feuille unique `styles/dashboard.css` pour le
  tableau de bord.
- Pages chargées à la demande (`React.lazy`) ; images en WebP avec `loading="lazy"`.
- Modules à venir (`paiement`, `appels`) : composants « Bientôt disponible » déjà en place.
