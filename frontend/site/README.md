# Site public CIR

React 19 + Vite + react-router 7. Adresse : revelation-sarl.com. Vague 0 : agent `site`, vérifié par `site-testeur`.

- [x] Vite + React, alias `@` (→ `src/`) et `@partage` (→ `../partage`)
- [x] `src/app/` : `main.jsx`, `App.jsx`, `routes.jsx` (pages chargées à la demande), `api.js` (client API)
- [x] `src/layout/` : `Gabarit`, `Entete`, `PiedDePage` (partenaire Jiuye), `BarreOnglets` mobile
  (Accueil, Catalogue, Réalisations, Commandes, Compte), `BientotDisponible`, `PageIntrouvable`
- [x] Module `compte` (voir son README)
- [x] Vitest + Testing Library (`npm test`), test de fumée `src/test/fumee.test.jsx`
- [x] `railway.toml`, `Dockerfile`, `.env.example`

## Commandes

```bash
cd frontend/site
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm install
npm run dev                  # http://localhost:5173
npm test                     # Vitest (src/ et ../partage/)
npm run build                # dist/
npm start                    # sert dist/ (serve -s), port $PORT ou 3000
```

## Routes

| Chemin | Page |
|---|---|
| `/` | Accueil (« Bientôt disponible », vague 1) |
| `/catalogue`, `/realisations` | « Bientôt disponible » (vague 1) |
| `/connexion`, `/inscription` | module `compte` ; `?suite=/chemin` pour revenir après connexion |
| `/compte` | profil (protégé) |
| `/commandes` | « Bientôt disponible » (protégé, vague 2) |
| `*` | page introuvable |

## API utilisée (back-end Django, base `VITE_API_URL`)

- `POST /api/comptes/inscription/` `{email, mot_de_passe, nom_complet, telephone?, ville, quartier, rue_ou_repere}` → `{utilisateur, acces, rafraichissement}`
- `POST /api/comptes/connexion/` `{email, mot_de_passe}` → `{acces, rafraichissement, utilisateur}`
- `POST /api/comptes/connexion/rafraichir/` `{rafraichissement}` → `{acces, rafraichissement}`
- `POST /api/comptes/deconnexion/` `{rafraichissement}` (liste noire)
- `GET/PATCH /api/comptes/moi/` → `{id, email, nom_complet, telephone, role, est_equipe, ville, quartier, rue_ou_repere, adresse_complete (booléen), adresse_formatee, date_inscription}` ; e-mail et rôle non modifiables

## Déploiement Railway

Le site importe `../partage` : le `Dockerfile` est construit depuis la racine du dépôt. Réglages du service :
root directory vide (racine), config file path `frontend/site/railway.toml`, watch paths
`/frontend/site/**` et `/frontend/partage/**`, variable `VITE_API_URL` (lue au build).
