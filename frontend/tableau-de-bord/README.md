# Tableau de bord CIR

React 19 + Vite + react-router. `src/app/` (App.jsx, routes.jsx, main.jsx, api.js), `src/layout/`, `src/modules/<module>/`.
Adresse distincte : admin.revelation-sarl.com, réservée à l’équipe (jamais liée depuis le site public).

## Démarrer

```bash
cd frontend/tableau-de-bord
cp .env.example .env.local   # VITE_API_URL = adresse du back-end (http://localhost:8000 en dev)
npm install
npm run dev                  # http://localhost:5174 (le site public est sur 5173)
npm test                     # Vitest + Testing Library
npm run build                # dist/
```

Le code commun (client API, composants, jetons de style) vient de `frontend/partage/` via l’alias `@partage`.
Jetons de session rangés sous `localStorage["cir-tdb.jetons"]`, séparés de ceux du site.

Multilingue (fr, en, zh, de, ja) : textes dans `src/i18n/`, choix de la langue dans l'en-tête et sur la page de
connexion (`localStorage["cir-tdb.langue"]`), langue enregistrée dans le compte du membre connecté, langue
préférée du client affichée sur sa fiche. Voir `frontend/partage/README.md` et `docs/decisions/7-multilingue.md`.

## Vague 0 : socle (agent `tableau-de-bord`, vérifié par `tableau-de-bord-testeur`)

- [x] Application Vite + React séparée du site (port 5174), routes chargées à la demande
- [x] `src/layout/` : coque avec menu latéral (tiroir sur téléphone), en-tête (personne connectée, rôle, déconnexion)
- [x] Entrées des modules des vagues suivantes marquées « Bientôt disponible » (`layout/menu.js`)
- [x] Accueil : page de bienvenue et raccourcis (`layout/AccueilPage.jsx`, remplacée par les statistiques en vague 4)
- [x] Modules `connexion`, `equipe`, `clients` (voir leurs README)
- [x] Vitest configuré, test de fumée (`src/test/fumee.test.jsx`)
- [x] `railway.toml`, `Dockerfile` (contexte : racine du dépôt), `.env.example`
- [x] Aucune indexation : `public/robots.txt` (`Disallow: /`), `<meta name="robots" content="noindex">`,
      en-tête `X-Robots-Tag: noindex` servi par `serve` (`public/serve.json`)
- [x] Suite de tests complète (testeur)

## Vague 1 : vitrine (agent `tableau-de-bord`, vérifié par `tableau-de-bord-testeur`)

Contrat d'API : `docs/taches/vague-1-contrat-api.md`.

- [x] Modules `catalogue`, `vitrine`, `actualites`, `contenus` passés dans « Pilotage » (`layout/menu.js`), routes
      chargées à la demande (`catalogue/*`, `vitrine/*`, `actualites`, `contenus/*` ; sous-routes dans chaque page)
- [x] Composants propres au tableau de bord (`src/composants/`) :
  - `Tiroir.jsx` : panneau latéral modal (focus piégé, Échap, voile, retour du focus)
  - `OngletsLangues.jsx` : onglet Français (obligatoire) + en, zh, de, ja ; pastille sur les langues à compléter ;
    édite l'objet `traductions` ; exporte aussi `BarreLangues` et `PastilleTraductions`
  - `ChampImage.jsx` : aperçu, choix, retrait, contrôle de taille, erreur 400 (variante `video`)
  - `BoutonSupprimer.jsx` (confirmation dans la ligne), `SousNavigation.jsx`
  - `langues.js` (`languesIncompletes`, `modifierTraduction`), `envoi.js` (JSON ou multipart, `repartirErreur`,
    `lirePrix`, dates locales), `useChargement.js`, `usages.js`, `Composants.module.css`, `Gestion.module.css`
- [x] Textes de l'interface dans les cinq langues (`src/i18n/`)
- [x] Tests de base (`src/composants/Composants.test.jsx`, un test par page ; outils dans `src/test/api-simulee.jsx`)
- [ ] Suite de tests complète (testeur)

## Vague 2 : commande (agent `tableau-de-bord`, vérifié par `tableau-de-bord-testeur`)

Contrat d'API : `docs/taches/vague-2-contrat-api.md`.

- [x] Modules `commandes`, `devis`, `contact` dans « Pilotage » (`layout/menu.js`), routes à la demande
      (`/commandes`, `/commandes/:id`, `/devis`, `/devis/nouveau?commande=`, `/devis/:id`, `/contact`)
- [x] Pastilles du menu (`layout/usePastilles.js`) : `action_requise` (commandes), `nouvelle` (devis, contact), rechargées à la navigation
- [x] Composants communs ajoutés à `src/composants/` : `Onglets`, `ConfirmerAction`, `NotesInternes`, `LiensContact`,
      `PastilleEtat`, `useCriteres`, `useListe`, `Pilotage.module.css`
- [x] Textes dans les cinq langues (`src/i18n/`), tests (`Commandes.test.jsx`, `Devis.test.jsx`, `Contact.test.jsx`, `Coque.test.jsx`)
- [ ] Suite de tests complète (testeur)

## Déploiement (Railway)

Service à part : config file `frontend/tableau-de-bord/railway.toml`, root directory vide (racine du dépôt),
variable `VITE_API_URL` (lue au build). Domaine : admin.revelation-sarl.com, à ajouter aux origines CORS du back-end.
