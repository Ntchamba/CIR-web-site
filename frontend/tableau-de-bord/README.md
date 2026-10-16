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

## Déploiement (Railway)

Service à part : config file `frontend/tableau-de-bord/railway.toml`, root directory vide (racine du dépôt),
variable `VITE_API_URL` (lue au build). Domaine : admin.revelation-sarl.com, à ajouter aux origines CORS du back-end.
