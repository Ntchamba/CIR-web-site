# Site public CIR

React 19 + Vite + react-router 7. Adresse : revelation-sarl.com. Vague 0 : agent `site`, vérifié par `site-testeur`.

- [x] Vite + React, alias `@` (→ `src/`) et `@partage` (→ `../partage`)
- [x] `src/app/` : `main.jsx`, `App.jsx`, `routes.jsx` (pages chargées à la demande), `api.js` (client API)
- [x] `src/layout/` : `Gabarit`, `Entete`, `PiedDePage` (partenaire Jiuye), `BarreOnglets` mobile
  (Accueil, Catalogue, Réalisations, Commandes, Compte), `BientotDisponible`, `PageIntrouvable`
- [x] Module `compte` (voir son README)
- [x] Vague 1 : modules `accueil`, `catalogue`, `produit`, `vitrine`, `actualites` (voir leurs README)
- [x] `src/app/useDonnees.js` (donnée de l'API, rechargée au changement de langue), `useListePaginee.js`
  (listes paginées et « Voir plus »), `preferences.js` (mouvement réduit, économie de données)
- [x] `src/composants/` : `ImageMedia` (image `{url, alt}`, dimensions, `loading="lazy"`), `Paragraphes`,
  `VoirPlus`, `EnteteSection`
- [x] `src/layout/contenus.js` : `GET /api/contenus/accueil/` (une requête par langue, partagée) et
  `useCoordonnees()` pour l'en-tête et le pied de page, avec repli sur `coordonnees.js`
- [x] Vitest + Testing Library (`npm test`), test de fumée `src/test/fumee.test.jsx` ; outils
  `src/test/outils.jsx` (`simulerApi` : le gestionnaire reçoit `(corps, init, url)`, `page()`,
  `parametresDes()`, `simulerMouvementReduit()`)
- [x] `railway.toml`, `Dockerfile`, `.env.example`
- [x] Multilingue (fr, en, zh, de, ja) : textes dans `src/i18n/`, choix de la langue dans l'en-tête et le pied
  de page, `?lang=en` dans une adresse partagée, langue enregistrée dans le compte du client connecté
  (voir `frontend/partage/README.md` et `docs/decisions/7-multilingue.md`)

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
| `/` | Accueil (module `accueil`) |
| `/catalogue` | Catalogue, `?famille=&usage=&q=` (module `catalogue`) |
| `/catalogue/:slug` | Fiche produit (module `produit`) |
| `/realisations` | Réalisations, démos, témoignages, `?type=` (module `vitrine`) |
| `/actualites`, `/actualites/:slug` | Actualités (module `actualites`) |
| `/connexion`, `/inscription` | module `compte` ; `?suite=/chemin` pour revenir après connexion |
| `/compte` | profil (protégé) |
| `/commandes` | « Bientôt disponible » (protégé, vague 2) |
| `*` | page introuvable |

## API utilisée (back-end Django, base `VITE_API_URL`)

Toutes les requêtes envoient `Accept-Language` (langue de l'interface) : les messages d'erreur reviennent traduits.

- `POST /api/comptes/inscription/` `{email, mot_de_passe, nom_complet, telephone?, ville, quartier, rue_ou_repere, langue}` → `{utilisateur, acces, rafraichissement}`
- `POST /api/comptes/connexion/` `{email, mot_de_passe}` → `{acces, rafraichissement, utilisateur}`
- `POST /api/comptes/connexion/rafraichir/` `{rafraichissement}` → `{acces, rafraichissement}`
- `POST /api/comptes/deconnexion/` `{rafraichissement}` (liste noire)
- Vague 1 (contrat `docs/taches/vague-1-contrat-api.md`, lectures publiques envoyées sans jeton) :
  `GET /api/contenus/accueil/`, `GET /api/catalogue/familles/`, `GET /api/catalogue/produits/` (+ `<slug>/`),
  `GET /api/vitrine/realisations/`, `GET /api/vitrine/demos/`, `GET /api/vitrine/temoignages/`,
  `POST /api/vitrine/temoignages/` et `GET /api/vitrine/temoignages/miens/` (connecté), `GET /api/actualites/` (+ `<slug>/`).
  Le contenu arrive traduit dans la langue de l'interface ; il est redemandé quand la langue change.
- `GET/PATCH /api/comptes/moi/` → `{id, email, nom_complet, telephone, role, est_equipe, langue, ville, quartier, rue_ou_repere, adresse_complete (booléen), adresse_formatee, date_inscription}` ; e-mail et rôle non modifiables

## Déploiement Railway

Le site importe `../partage` : le `Dockerfile` est construit depuis la racine du dépôt. Réglages du service :
root directory vide (racine), config file path `frontend/site/railway.toml`, watch paths
`/frontend/site/**` et `/frontend/partage/**`, variable `VITE_API_URL` (lue au build).
