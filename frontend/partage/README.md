# Code commun aux deux applications React

Utilisé par `frontend/site/` et `frontend/tableau-de-bord/` via l'alias Vite `@partage` (→ `frontend/partage`).
Vague 0, agent `site`, vérifié par `site-testeur`.

- [x] `api/client.js` : appels HTTP + JWT, rafraîchissement automatique, erreurs en français
- [ ] `api/socket.js` : WebSocket (vague 3)
- [x] `ui/` : Bouton, Champ, Chargement, EtatVide, MessageErreur, Icone (`Modale` : plus tard)
- [x] `styles/` : `jetons.css` (couleurs, polices, espacements), `base.css`
- [x] `utils/` : `format.js` (FCFA, dates), `usePageMeta.js` (titres et descriptions)

## Brancher une application

Ce dossier n'a pas de `package.json` : React et les polices viennent de l'application. Dans `vite.config.js` :

```js
resolve: {
  alias: { '@partage': fileURLToPath(new URL('../partage', import.meta.url)) },
  // les fichiers de ../partage n'ont pas de node_modules : résoudre ces paquets depuis l'application
  dedupe: ['react', 'react-dom', 'react-router', '@testing-library/react', '@testing-library/user-event'],
},
server: { fs: { allow: ['..'] } },
```

Dans `main.jsx` (polices auto-hébergées : `npm i @fontsource-variable/lora @fontsource-variable/figtree`) :

```js
import '@fontsource-variable/lora/index.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/figtree/index.css';
import '@partage/styles/jetons.css';
import '@partage/styles/base.css';
```

## `api/client.js`

```js
import { creerClientApi, CHEMINS, ErreurApi, erreursChamps, resultats } from '@partage/api/client.js';

export const api = creerClientApi({ baseUrl: import.meta.env.VITE_API_URL, cleStockage: 'cir-tdb' });
```

`creerClientApi({ baseUrl, cleStockage = 'cir', cheminRafraichir = CHEMINS.rafraichir, fetch })` renvoie :

| Fonction | Rôle |
|---|---|
| `get(chemin, options)` | GET. `options` : `{ auth = true, signal, entetes }` |
| `post(chemin, corps, options)`, `put`, `patch` | corps envoyé en JSON |
| `supprimer(chemin, options)` | DELETE |
| `envoyerFichiers(chemin, formData, { methode })` | envoi multipart (POST par défaut) |
| `requete(chemin, { methode, corps, formulaire, auth, signal, entetes })` | forme générale |
| `connecter({ email, mot_de_passe }, { chemin })` | connexion, range les jetons, renvoie `{ acces, rafraichissement, utilisateur }`. Tableau de bord : `{ chemin: CHEMINS.connexionEquipe }` (403 pour un client) |
| `deconnecter({ chemin })` | met le jeton de rafraîchissement en liste noire puis efface les jetons |
| `retenirJetons(reponse)` | range `{ acces, rafraichissement }` d'une réponse (ex. inscription) |
| `rafraichir()` | renouvelle le jeton d'accès ; `true`/`false` |
| `jetons.lire()`, `jetons.ecrire(j)`, `jetons.effacer()`, `jetons.abonner(rappel)` | jetons `{ acces, rafraichissement }` dans `localStorage["<cleStockage>.jetons"]` ; `abonner` renvoie la fonction de désabonnement (appelé avec `null` à la déconnexion) |

Comportement : en-tête `Authorization: Bearer <acces>` ; sur 401, un seul rafraîchissement
(`POST /api/comptes/connexion/rafraichir/ {rafraichissement}` → `{acces, rafraichissement?}`), partagé par les
requêtes simultanées, puis la requête est rejouée une fois. Si le rafraîchissement est refusé, les jetons sont
effacés. Réponse 204 → `null`.

Erreurs : toujours une `ErreurApi` (sauf `AbortError`), avec `statut` (0 = serveur injoignable), `donnees`
(corps JSON), `message` lisible en français (`detail` de DRF, sinon premier message de champ, sinon message
selon le code ; jamais le détail technique d'une 5xx) et `champs` (`{ email: 'Un compte existe déjà…' }`).
Aussi exportés : `erreursChamps(erreur)`, `premierMessage(donnees)`, `messageParStatut(statut)`,
`resultats(donnees)` (liste d'une réponse paginée `{ results }` ou d'une liste).

## `ui/`

Import direct (`@partage/ui/Bouton.jsx`) ou groupé (`import { Bouton, Champ } from '@partage/ui'`).
Aucun composant ne dépend du routeur.

| Composant | Propriétés |
|---|---|
| `Bouton` | `variante` (`plein`, `contour`, `sombre`, `texte`), `taille` (`petit`, `large`), `chargement`, `as` (ex. `as={Link} to="/"`, `as="a" href="tel:…"`) ; sinon `<button type="button">` |
| `Champ` | `libelle`, `aide`, `erreur`, `type`, `required`, `options` (`[[valeur, texte]]` → select), `multiligne` (textarea) ; autres props passées à la saisie ; libellé, aide et erreur reliés (`aria-describedby`, `aria-invalid`) |
| `Chargement` | `plein`, `texte` (`role="status"`) |
| `EtatVide` | `titre`, `children`, `action`, `niveau` (titre h2 par défaut) |
| `MessageErreur` | `erreur` (texte ou `ErreurApi`), `reessayer` (bouton « Réessayer ») ; `role="alert"` ; rien si pas d'erreur |
| `Icone` | `nom` (voir `NOMS_ICONES`), `taille`, `epaisseur` ; décorative (`aria-hidden`) |

## `styles/`

`jetons.css` : variables CSS (`--encre #0E2A38`, `--bleu #1177A8`, `--corail #FF6D4C`, `--fond #F3F7F9`,
`--police-titre` Lora, `--police-texte` Figtree, `--rayon*`, `--esp-1…7`, `--cible-tactile` 44 px, statuts
`--st-*`). `base.css` : remise à zéro, `prefers-reduced-motion`, focus visible corail, `.visuellement-cache`.

## `utils/`

- `format.js` : `fcfa(v)` → « 12 500 FCFA » (« — » si vide), `prix(v, unite)` → « Prix sur devis » si absent,
  `surface(v)`, `date(v, options)` → « 16 octobre 2026 », `dateHeure(v)`, `depuis(v)` → « il y a 5 min »,
  `UNITES`, `STATUTS` (étapes d'une commande).
- `usePageMeta.js` : `usePageMeta(titre, description)` ; `configurerPageMeta({ suffixe, titreParDefaut })`
  une fois par application ; `titreComplet(titre)`.

## Tests

Les tests de ce dossier (`*.test.js(x)`) sont lancés par `npm test` dans `frontend/site/`
(motif `../partage/**/*.test.{js,jsx}` de `vite.config.js`).
