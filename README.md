# CIR : plateforme web du Complexe Industriel Révélation SARL

Application web du **Complexe Industriel Révélation SARL (CIR)**, Douala (Cameroun) : vitrine, catalogue, prise de commande,
négociation, échanges en direct, paiement et assistant IA pour des **revêtements de sol en résine époxy**
(partenaire fabricant : **Jiuye**), destinés à la maison, à l'industrie et à l'entreprise.

- Domaine prévu : `revelation-sarl.com` (site), `admin.revelation-sarl.com` (tableau de bord de l'équipe),
  `api.revelation-sarl.com` (API).
- Cahier des charges : `docs/cahier-des-charges/` (besoins fonctionnels BF-01 à BF-17, non fonctionnels BNF-01 à BNF-10).
- Le code, les commentaires, la documentation et les messages de commit sont **en français**. L'interface est
  **multilingue** : français (référence), anglais, chinois, allemand, japonais.
- **À lire en premier pour reprendre le projet : `docs/passation.md`** (état, décisions, méthode de travail des agents).

---

## 1. Où en est le projet

Les six vagues de la fiche des tâches (`docs/taches/`) sont livrées, validées par leurs agents testeurs et fusionnées
dans `main`. Le design des maquettes a été repris à l'identique, avec une entrée 3D au défilement.

| Étape | Contenu | État |
|---|---|---|
| Vague 0 | Socle : comptes, rôles, noyau, site et tableau de bord de base | Terminée |
| Multilingue | Français, anglais, chinois, allemand, japonais (`docs/decisions/7-multilingue.md`) | Terminée |
| Vague 1 | Catalogue, vitrine, actualités, contenus de l'accueil | Terminée |
| Vague 2 | Sélection, commandes et négociation, devis, contact | Terminée |
| Vague 3 | Messagerie, appels (JaaS), notifications, e-mails (Gmail) | Terminée |
| Vague 4 | Paiements (CamPay), règlements hors ligne, statistiques | Terminée |
| Vague 5 | Assistant IA (Gemini) : conseiller client, brouillons pour l'équipe | Terminée |
| Images et 3D | Médias fournis, catalogue fusionné, design fidèle aux maquettes, entrée 3D | Terminée |

Vérifications au dernier passage : **back-end 1445 tests** (aussi sur PostgreSQL 16), **site 687 tests**, **tableau de bord
506 tests**, intégrations 149 tests (comptés dans le back-end). Contrôles de concurrence réels sur PostgreSQL (paiements,
quotas, réponse aux appels, file d'e-mails, assistant). Parcours vérifiés dans un vrai navigateur (Chromium).

**Ce qui n'a pas pu être vérifié** : aucun appel réel aux services externes (CamPay, JaaS, Gmail, Gemini), faute de clés ;
aucun déploiement réel sur Railway. Voir la section 13 « Limites connues et reste à faire ».

---

## 2. Ce que fait la plateforme

### Pour les visiteurs et les clients (site public)
- **Accueil** : vidéo de fond jouée une fois, sphère 3D de photos de sols, sélection de produits, avant / après, contact.
- **Catalogue** : filtres par usage (maison, industrie, entreprise, extérieur) et par famille, recherche, grille d'images carrées,
  pagination. **Fiche produit** : image du produit en grand carré sur son propre fond flouté, options, « Sélectionner ce produit ».
- **Réalisations**, **actualités**, **témoignages** (publiés après validation de l'équipe).
- **Compte** : inscription avec adresse complète (ville, quartier, rue ou repère), connexion, profil, langue préférée,
  consentement aux nouveautés par e-mail (désactivé par défaut).
- **Sélection** de produits, **commande** (compte et adresse complète obligatoires), **négociation** (propositions et
  contre-propositions de prix au m², total, délai), **devis**, **demande de rendu** personnalisé, **contact**.
- **Paiement** après « Contrat signé » : Mobile Money (MTN, Orange) ou lien de paiement CamPay, acomptes possibles, reçu imprimable.
- **Messagerie** en direct avec l'équipe (pièces jointes privées), **appels** audio et vidéo (Jitsi), **notifications**.
- **Assistant IA** : conseils sur le catalogue et suivi de ses commandes, jamais de prix ferme.

### Pour l'équipe (tableau de bord, application séparée)
- Commandes (étapes, négociation, règlements hors ligne), devis, demandes de contact et de rendu.
- Catalogue, vitrine, actualités et contenus du site, avec un **onglet par langue** pour chaque texte.
- Messagerie en direct, sonnerie et réponse aux appels, notifications, modèles d'e-mails, suivi de la file d'envoi.
- Paiements (revérification, anomalies), **statistiques** (les sommes d'argent ne sont visibles que du super-administrateur).
- Assistant : brouillons à relire, journal, usage et limites.
- Clients et équipe (création des comptes de l'équipe par le super-administrateur).
- **Le tableau de bord n'est jamais lié depuis le site public et n'accepte que les comptes de l'équipe.**

---

## 3. Règles métier (non négociables)

- **Commande** : impossible sans compte **et** adresse complète. Vérifié côté serveur.
- **Étapes** : Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée (+ Annulée), transitions strictes.
- **Négociation** : seule l'autre partie peut accepter ; accepter passe en « Contrat signé » et fixe le montant convenu.
- **Prix** : facultatifs ; absent = « Prix sur devis ». **Ne jamais inventer** de prix, de témoignage, de nom de client ou de chantier.
- **Paiement** : seulement après « Contrat signé » ; une commande n'est **payée qu'après revérification de la transaction auprès
  de CamPay** (un webhook ou le navigateur ne sont jamais une preuve). Jamais plus que le reste à payer.
- **Assistant IA** : ne fixe aucun prix ferme, ne signe rien, ne déclenche aucun paiement, n'écrit rien (outils en lecture seule).
  Des garde-fous en code contrôlent chaque réponse.
- **Rôles** : `client`, `membre` (équipe), `super_admin`.
- **Montants** : entiers en FCFA (XAF), plafonnés à 2 147 483 647.
- **Quotas** (protégés contre les requêtes simultanées) : 5 commandes par jour, 5 demandes de rendu, 5 témoignages,
  10 messages de contact par compte, 5 par heure et par adresse IP ; messagerie 30 par minute ; appels 5 par heure ; paiements 5 par heure ;
  assistant : visiteur 20 par heure, client 60 par heure et 200 par jour, plafond global réglable.

---

## 4. Architecture

```
cir-web-site/
├── backend/                  Django 5.2 LTS · DRF · Channels (daphne) · JWT · PostgreSQL (SQLite en dev)
│   ├── apps/<module>/        un module par fonction (models, serializers, views, views_admin, urls, urls_admin,
│   │                         services, permissions, tests/)
│   ├── integrations/         un dossier par service externe : campay, gemini, gmail, jaas
│   ├── config/               réglages (dev, prod), URL, ASGI, routage WebSocket
│   ├── agents/               prompts, connaissances et évaluations de l'assistant IA
│   ├── medias_reference/     vidéo et images fournies, à charger en base (voir section 5)
│   └── locale/               traductions du back-end (.po / .mo)
├── frontend/
│   ├── site/                 site public : React 19 + Vite
│   ├── tableau-de-bord/      application de l'équipe : React 19 + Vite (séparée)
│   └── partage/              client API, WebSocket, i18n, composants et styles communs
├── docs/                     architecture, décisions, fiches de tâches, contrats d'API, maquettes de référence
├── infra/                    notes d'infrastructure
├── agents/                   renvoi vers backend/agents/
└── .claude/agents/           agents Claude qui codent et testent le projet (voir section 12)
```

**Principes** : API REST en JSON sous `/api/<module>/` (public) et `/api/admin/<module>/` (équipe) ; un seul WebSocket
`/ws/` par utilisateur connecté (messagerie, notifications, appels, paiements) ; règles métier dans `services.py`, jamais
dans les vues ; chaque service externe est isolé dans `backend/integrations/<service>/` (changer de prestataire ne touche
que ce dossier) ; les modules métier n'importent jamais `notifications` (ils émettent des signaux Django).

**Technologies** : Python 3.13, Django 5.2, Django REST Framework, simplejwt, Channels et daphne, Pillow (WebP), WhiteNoise ;
React 19, react-router 7, Vite 8, Vitest et Testing Library ; Playwright pour les vérifications dans un vrai navigateur.

---

## 5. Où sont les vidéos, images et autres médias

Il y a **deux endroits dans le dépôt** (back-end et front-end), plus deux dossiers d'exécution qui ne sont pas versionnés.

| Quoi | Où | Rôle |
|---|---|---|
| **Vidéo de fond** (`fond.mp4`, `fond.webm`) et **11 images** WebP (sphère, produits, affiches) | `backend/medias_reference/` (`video/`, `images/`, `medias.json`) | Sources à **charger en base** par `python manage.py importer_medias_reference` ; elles sont ensuite stockées dans `MEDIA_ROOT` |
| **Fonds des pages et bandeaux** (`fond-maison-*.webp`, `bandeau-maison-*.webp`) | `frontend/site/public/media/accueil/` | Fichiers statiques du site, servis tels quels |
| **Logos** CIR et Jiuye, icônes de l'onglet | `frontend/site/public/media/marque/`, `frontend/tableau-de-bord/public/media/marque/`, `public/favicon.png` | Fichiers statiques |
| **Fichiers téléversés** par l'équipe (images de produits, réalisations, actualités…) | `MEDIA_ROOT` (`backend/media/` en local, volume Railway `/data/media` en production), servis par Django sous `/media/` | **Non versionné** (`.gitignore`) ; convertis en WebP légers à l'envoi |
| **Pièces jointes de la messagerie** | `PRIVATE_ROOT` (`backend/prive/`, volume `/data/prive` en production) | **Privé** : jamais sous `/media/`, téléchargement protégé par vérification des droits |

Les images et la vidéo de `docs/reference/` (maquettes) **ne sont pas conservées** et ne doivent pas être utilisées.
Origine : la vidéo vient des maquettes du propriétaire ; les 11 images viennent de l'archive `im.zip` fournie par le propriétaire ;
l'affiche, les fonds et les bandeaux sont tirés de la vidéo. Ces images semblent générées : **aucune « réalisation » n'est créée avec**.

Charger le catalogue de départ et les médias (idempotent, rien d'inventé, aucun prix) :

```bash
python manage.py charger_catalogue_reference   # 9 familles et 16 produits (cahier des charges + maquette), sans prix ni image
python manage.py importer_medias_reference     # vidéo et affiche de l'accueil, 9 photos de sphère, 6 images de produits
```

`--forcer` remplace les médias importés ; les photos ajoutées par l'équipe ne sont jamais supprimées.

---

## 6. Modules du back-end

| Module | Rôle | Routes (`/api/…`) |
|---|---|---|
| `noyau` | Socle : langues, traductions, images WebP, verrous, références, montants, présence, diffusion en direct, santé | `sante/` |
| `comptes` | Comptes, rôles, connexion JWT, profil, équipe | `comptes/`, `admin/comptes/` |
| `catalogue` | Familles, produits, designs, prix facultatifs | `catalogue/`, `admin/catalogue/` |
| `vitrine` | Réalisations, démos, témoignages | `vitrine/`, `admin/vitrine/` |
| `actualites` | Nouveautés | `actualites/`, `admin/actualites/` |
| `contenus` | Textes et médias de l'accueil, bandeaux, sphère de photos | `contenus/`, `admin/contenus/` |
| `selection` | Sélection de produits d'un client | `selection/` |
| `commandes` | Commandes, étapes, négociation, contrats | `commandes/`, `admin/commandes/` |
| `devis` | Devis (calculés côté serveur), demandes de rendu | `devis/`, `admin/devis/` |
| `contact` | Messages de contact, anti-robot | `contact/`, `admin/contact/` |
| `messagerie` | Conversations client ↔ équipe, pièces jointes privées, WebSocket `/ws/` | `messagerie/`, `admin/messagerie/` |
| `appels` | Appels audio et vidéo, sonnerie, usage JaaS, webhook | `appels/`, `admin/appels/` |
| `notifications` | Notifications, file d'e-mails, modèles d'e-mails, désabonnement | `notifications/`, `admin/notifications/` |
| `paiements` | Paiements CamPay, règlements hors ligne, reçus, webhook | `paiements/`, `admin/paiements/` |
| `statistiques` | Indicateurs et évolution (calculés à la lecture) | `admin/statistiques/` |
| `assistant` | Conseiller IA, brouillons, journal, garde-fous | `assistant/`, `admin/assistant/` |

Les contrats d'API détaillés (formats JSON, erreurs, règles) sont dans `docs/taches/vague-<n>-contrat-api.md`.

**Commandes de gestion** (`python manage.py …`) : `charger_catalogue_reference`, `importer_medias_reference`,
`compiler_traductions`, `envoyer_emails [--boucle]` (service « worker » : e-mails, nouveautés, appels manqués, pièces jointes
orphelines, paiements en attente, purge de l'assistant), `notifier_actualites`, `expirer_appels`, `purger_pieces_jointes`,
`reverifier_paiements`, `purger_assistant`, `evaluer_assistant` (manuelle, nécessite une vraie clé).

---

## 7. Front-ends

- **Site public** (`frontend/site/`) : `src/modules/<module>/` (accueil, catalogue, produit, vitrine, actualités, sélection,
  commandes, devis, contact, compte, messagerie, appels, notifications, paiements, assistant), `src/layout/` (en-tête,
  barre d'onglets mobile, pied de page, scène du salon), `src/app/` (routeur, caméra 3D, cadrages par page).
- **Tableau de bord** (`frontend/tableau-de-bord/`) : mêmes conventions, modules de l'équipe (commandes, clients, équipe,
  catalogue, vitrine, contenus, messagerie, appels, notifications, paiements, statistiques, assistant…).
- **Code partagé** (`frontend/partage/`) : client API (jetons JWT, renouvellement, erreurs traduites), connexion en direct
  (WebSocket), i18n, composants de base, styles.

Conventions : routes chargées à la demande, images WebP légères, cibles tactiles d'au moins 44 px, libellés de formulaire,
`prefers-reduced-motion` respecté. Objectif de performance : 300 à 500 ms.

---

## 8. Services externes (API)

Détail et variables : `docs/api-necessaires.pdf` (une page) et `backend/.env.example`. Chacun est **facultatif au démarrage** :
sans lui, la fonction est masquée ou en attente, jamais une erreur.

| Service | Sert à | Variables | Sans lui |
|---|---|---|---|
| **Gmail API** (Google) | E-mails (confirmations, notifications, reçus) | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_EXPEDITEUR` | Les e-mails restent en file d'attente |
| **CamPay** | Paiement MTN / Orange Money | `CAMPAY_USERNAME`, `CAMPAY_PASSWORD`, `CAMPAY_WEBHOOK_KEY`, `CAMPAY_BASE_URL` | Bouton « Payer » masqué ; règlements hors ligne possibles |
| **Jitsi as a Service** (8x8) | Appels audio et vidéo | `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY`, `JAAS_WEBHOOK_SECRET` | Boutons d'appel masqués |
| **Gemini API** (Google) | Assistant IA | `GEMINI_API_KEY` | Bulle d'assistant masquée |

Les clés se saisissent **uniquement comme variables d'environnement** (Railway, ou `backend/.env` en local, jamais versionné).
Ne jamais les écrire dans une conversation ni sur GitHub. Adresse du webhook CamPay à saisir dans leur console :
`<API_URL_PUBLIQUE>/api/paiements/webhooks/campay/`. Webhook JaaS (facultatif) : `<API_URL_PUBLIQUE>/api/appels/webhooks/jaas/`.

---

## 9. Multilingue

Langues : `fr` (référence et secours), `en`, `zh` (chinois simplifié), `de`, `ja`. Aucun texte visible n'est écrit en dur.

- **Front-end** : `const { t } = useTraduction()` ; textes dans `src/i18n/{fr,en,zh,de,ja}.js` ; toute clé ajoutée en français l'est
  dans les quatre autres (test `i18n.test.jsx`).
- **Back-end** : messages en français avec `gettext`, traduits dans `backend/locale/<langue>/LC_MESSAGES/django.po`, puis
  `python manage.py compiler_traductions` (le test `test_langues` échoue si un message n'est pas traduit).
- **Contenu saisi par l'équipe** : champ `traductions` et un onglet par langue dans le tableau de bord.
- Jamais de traduction inventée pour un nom propre (Jiuye, quartiers, clients). Les traductions anglaises, chinoises, allemandes
  et japonaises ont été rédigées par IA : **à faire relire par des locuteurs**.

---

## 10. Design et entrée 3D

- Couleurs : encre `#0E2A38`, bleu `#1177A8`, corail `#FF6D4C`, fond `#F3F7F9`. Polices : Lora (titres), Figtree (texte), DM Mono (repères).
- **Les maquettes ordinateur et téléphone font foi** pour la mise en page et les textes (`docs/reference/`, règle dans
  `docs/reference/design-fidele.md`). La 3D n'ajoute que du mouvement.
- **Entrée 3D** (`docs/decisions/11-entree-3d.md`) : le salon de la vidéo reste en fond de toutes les pages, avec un cadrage
  propre à chaque page ; à chaque clic, la caméra se déplace dans le salon ; sur l'accueil, le défilement zoome vers la lumière des
  fenêtres, puis le contenu apparaît ; un clic sur un produit fait grandir la vignette en grand carré. Les cadrages sont dans
  `frontend/site/src/app/cameras.js`.
- Le défilement reste **natif** (clavier, lecteurs d'écran, bouton précédent). Sans prise en charge, avec `prefers-reduced-motion`
  ou en économie de données, la page s'affiche à plat. Seuls `transform` et `opacity` sont animés. Flèche « < » de retour sur téléphone.

---

## 11. Installer et lancer en local

Prérequis : Python 3.13, Node 22. Aucun service à installer : SQLite suffit en développement.

```bash
# Back-end (http://127.0.0.1:8000)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                  # rien d'obligatoire en développement
python manage.py migrate
python manage.py createsuperuser      # premier super-administrateur
python manage.py charger_catalogue_reference
python manage.py importer_medias_reference
python manage.py runserver            # ASGI via daphne ; vérification : curl http://127.0.0.1:8000/api/sante/

# Site public (http://localhost:5173)
cd frontend/site && npm install && npm run dev

# Tableau de bord (http://localhost:5174)
cd frontend/tableau-de-bord && npm install && npm run dev
```

Les front-ends lisent `VITE_API_URL` (par défaut `http://localhost:8000`). Les e-mails s'affichent dans la console en développement.
Pour essayer PostgreSQL ou Redis, les installer sur la machine et renseigner `DATABASE_URL` et `REDIS_URL`.

**Tests**

```bash
cd backend && python manage.py test                       # apps et intégrations (sans --parallel)
cd frontend/site && npm test && npm run build
cd frontend/tableau-de-bord && npm test && npm run build
```

Tous les appels réseau des tests sont simulés : aucun test ne contacte CamPay, JaaS, Gmail ou Gemini.

---

## 12. Organisation du travail

- **Branches** : `main` (référence, à jour), `prototype-2` (branche de travail), une branche par étape livrée (`multilingue`,
  `vague-1` à `vague-5`, `images`). `prototype-1` reste intact comme référence. **Pas de pull request** : le propriétaire fusionne.
- **Agents** (`.claude/agents/`) : chaque agent qui code a son agent testeur — `backend` / `backend-testeur`, `integrations` /
  `integrations-testeur`, `site` / `site-testeur`, `tableau-de-bord` / `tableau-de-bord-testeur`. Chacun ne touche que sa zone.
  Un module n'est terminé que lorsque son testeur rend **VALIDÉ**.
- **Méthode** : un contrat d'API écrit d'abord (`docs/taches/vague-<n>-contrat-api.md`), les agents codent en parallèle, les
  testeurs relisent avec des essais adverses, puis vérification sur PostgreSQL et dans un vrai navigateur.
- **Conventions** : messages de commit en français ; secrets uniquement dans `.env` ; `.env.example` liste les variables.

---

## 13. Déploiement (Railway)

Un service par application, chacun avec son `railway.toml` (voir `infra/README.md`) :

| Service | Racine | Démarrage | Variables clés |
|---|---|---|---|
| Back-end | `/backend` | `collectstatic` puis `daphne` ; migrations avant mise en service ; santé `/api/sante/` | `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `DJANGO_ALLOWED_HOSTS`, `SITE_URL`, `ADMIN_URL_PUBLIQUE`, `API_URL_PUBLIQUE`, `DJANGO_MEDIA_ROOT`, `DJANGO_PRIVATE_ROOT`, `NOTIFICATIONS_ENVOI_IMMEDIAT=0` |
| Worker | `/backend` | `python manage.py envoyer_emails --boucle` | mêmes variables que le back-end, sans domaine public |
| Site | racine du dépôt (vide) | build Vite puis `serve` | `VITE_API_URL` (au build) |
| Tableau de bord | racine du dépôt (vide) | build Vite puis `serve` | `VITE_API_URL` (au build) |
| PostgreSQL, Redis | modules Railway | — | `DATABASE_URL`, `REDIS_URL` en référence |

Domaines : `revelation-sarl.com` et `www` vers le site, `admin.` vers le tableau de bord, `api.` vers le back-end (DNS chez Vercel).
Après le premier déploiement : créer le super-administrateur, puis lancer une fois `charger_catalogue_reference` et
`importer_medias_reference`.

**À savoir** : sans Redis, le service web et le worker ne partagent pas la présence en ligne.

---

## 14. Limites connues et reste à faire

- **Volume et worker (à corriger avant la mise en ligne)** : sur Railway, un volume ne se partage pas entre deux services. Le worker
  ne peut donc pas supprimer les pièces jointes privées de la messagerie, qui sont sur le volume du back-end (la purge doit tourner
  dans le service du back-end).
- **Clés réelles non testées** : formats des réponses et des webhooks de CamPay, de JaaS et de Gemini à confirmer (essai de CamPay sur
  `demo.campay.net`) ; rejouer les 35 cas de `backend/agents/evaluations/` avec `python manage.py evaluer_assistant`.
- **Gmail** : publier l'application Google en « Production », sinon le jeton d'envoi expire au bout de 7 jours.
- **Gemini** : le niveau gratuit peut réutiliser les échanges pour améliorer les produits de Google ; prévoir le niveau payant en production.
- **Connexion** : par e-mail seulement ; la maquette propose « Téléphone ou e-mail » et « Mot de passe oublié ? » (non faits).
- **Données** : 4 produits sans image (sable coloré, mate, anticorrosion, sol à motifs) ; familles et usages des 7 produits venus de
  la maquette à valider ; pas de témoignages ni de chantiers (aucune donnée réelle, rien d'inventé).
- **Divers** : pas de sitemap ; pas de PDF pour les devis et contrats (feuille de style d'impression seulement) ; quelques textes
  blancs sur les photos des bandeaux sont un peu sous le contraste idéal sans leur ombre portée.
- **Traductions** : à relire par des locuteurs natifs (anglais, chinois, allemand, japonais).

---

## 15. Documentation

| Fichier | Contenu |
|---|---|
| `docs/passation.md` | État du projet, décisions, méthode, reste à faire |
| `docs/architecture.md` | Architecture complète |
| `docs/cahier-des-charges/` | Cahier des charges (PDF et source LaTeX) |
| `docs/decisions/` | Décisions : multilingue (7), échanges en direct (8), paiements et statistiques (9), assistant IA (10), entrée 3D (11) |
| `docs/taches/` | Fiches de tâches par vague et contrats d'API |
| `docs/reference/` | Maquettes ordinateur et téléphone (code seulement) et règle de fidélité au design |
| `docs/api-necessaires.pdf` | Liste des API externes nécessaires (une page, sans aucune clé) |
| `backend/README.md` | Lancement du back-end, réglages, API de base |
| `CLAUDE.md` | Instructions pour les agents Claude (règles métier, conventions) |

Contact public de l'entreprise : Total Nkolmbong, Douala, Cameroun · +237 6 99 81 16 35 · +237 6 78 82 93 13 · +237 6 56 43 58 46 ·
WhatsApp +237 622 191 931.
