# CIR : application web de vente de revêtements de sol en résine époxy

Application du **Complexe Industriel Révélation SARL (CIR)**, Douala. Partenaire fabricant : **Jiuye**.
Elle permet de découvrir le catalogue, de voir les réalisations, de commander pour une maison, une
industrie ou une entreprise, puis de négocier et de suivre ses travaux avec l'équipe.

| Partie | Technologie | Dossier | Adresse en développement |
|---|---|---|---|
| Site public (visiteurs, clients) | React 19 + Vite | `frontend/site` | http://localhost:5173 |
| Tableau de bord (équipe du CIR) | React 19 + Vite | `frontend/dashboard` | http://localhost:5174 |
| Back-end et API | Django 5.2 LTS + Django REST Framework | `backend` | http://localhost:8000/api/ |
| Messagerie instantanée | Django Channels (WebSocket) | `backend/apps/messaging` | ws://localhost:8000/ws/ |
| Base de données | PostgreSQL (SQLite possible en développement) | | |

## Structure du dépôt

```
CIR-web-site/
├── README.md                 ce fichier
├── .gitignore                fichiers jamais versionnés (dépendances, secrets, bases locales…)
├── .editorconfig
├── docs/
│   ├── architecture.md       correspondance besoins du cahier des charges ↔ modules
│   └── modules-a-venir.md    paiement bancaire, appels, e-mails : ce qui est prévu
├── backend/                  Django
│   ├── config/               réglages (base, dev, prod), routes, ASGI (WebSocket)
│   ├── apps/                 un module par fonction (voir docs/architecture.md)
│   │   ├── core/             socle commun, données de démonstration (seed_demo)
│   │   ├── accounts/         BF-08, BF-17  comptes, adresse, équipe
│   │   ├── catalog/          BF-01, 05, 06, 14  produits, prix, fiches techniques
│   │   ├── showcase/         BF-02, 03, 04  réalisations, démos, témoignages
│   │   ├── news/             BF-07  nouveautés
│   │   ├── site_content/     BF-15  accueil, sphère, coordonnées
│   │   ├── selection/        BF-09  sélection de designs
│   │   ├── orders/           BF-10, 12, 13, 16  commandes, négociation, suivi
│   │   ├── contact/          BF-11  contact, design sur mesure
│   │   ├── messaging/        messagerie instantanée client ↔ équipe
│   │   ├── dashboard/        statistiques du tableau de bord
│   │   ├── notifications/    À VENIR : e-mails (Gmail)
│   │   ├── payments/         À VENIR : paiement par compte bancaire
│   │   └── telephony/        À VENIR : appels (Orange, MTN, international)
│   ├── seed/images/          photos du catalogue et des réalisations (WebP)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── shared/               commun aux deux applications : couleurs, polices, client API, WebSocket
    ├── site/                 site public
    │   ├── public/media/     vidéo, images de l'accueil, logos (WebP)
    │   └── src/
    │       ├── components/   layout (en-tête, barre d'onglets mobile, pied de page, bandeau) et ui
    │       ├── modules/      accueil, catalogue, produit, realisations, nouveautes, compte,
    │       │                 selection, commandes, messagerie, contact, paiement*, appels*
    │       ├── hooks/  lib/  styles/
    │       └── App.jsx       routes
    └── dashboard/            tableau de bord (application séparée)
        └── src/modules/      auth, tableau-de-bord, commandes, messagerie, demandes, catalogue,
                              clients, contenus, paiements*, appels*
```
`*` : module à venir, emplacement déjà réservé (« Bientôt disponible »).

## Installation

Prérequis : **Python 3.12+**, **Node.js 20+** (npm), et **PostgreSQL 14+** si vous ne voulez pas SQLite.

### 1. Back-end

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                  # puis adapter les valeurs
python manage.py migrate
python manage.py seed_demo            # catalogue, réalisations, compte admin, client de démonstration
python manage.py runserver            # http://localhost:8000 (HTTP + WebSocket)
```

Avec PostgreSQL : créer la base puis renseigner `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` dans `.env`.

```bash
sudo -u postgres psql -c "CREATE USER cir WITH PASSWORD 'motdepasse';"
sudo -u postgres psql -c "CREATE DATABASE cir OWNER cir;"
```

Tests : `python manage.py test apps`

### 2. Site public

```bash
cd frontend/site
npm install
cp .env.example .env.local
npm run dev                           # http://localhost:5173
```

### 3. Tableau de bord

```bash
cd frontend/dashboard
npm install
cp .env.example .env.local
npm run dev                           # http://localhost:5174
```

### Comptes de démonstration (créés par `seed_demo`)

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur (dashboard) | valeur de `SEED_ADMIN_EMAIL` (défaut : admin@cir.cm) | valeur de `SEED_ADMIN_PASSWORD` |
| Client (site) | client@exemple.cm | Client-Demo-2026 |

À changer avant toute mise en ligne. Les textes entre crochets `[ ]` sont à remplacer par l'équipe depuis
le tableau de bord (prix, références, témoignages réels…).

## API (résumé)

| Préfixe | Accès | Contenu |
|---|---|---|
| `/api/comptes/` | public / client | inscription, connexion (JWT), profil et adresse |
| `/api/catalogue/` | public | familles, produits (`?famille=`, `?usage=`, `?search=`) |
| `/api/vitrine/` | public | réalisations, démos, témoignages |
| `/api/nouveautes/`, `/api/contenus/accueil/` | public | nouveautés, contenu de l'accueil |
| `/api/selection/` | client | sélection de designs |
| `/api/commandes/` | client | commandes, propositions, acceptation |
| `/api/messagerie/` | client | conversations et messages |
| `/api/contact/` | public | formulaire de contact |
| `/api/admin/…` | équipe (`is_staff`) | tout le tableau de bord |
| `/ws/messagerie/<id>/?jeton=…` | client ou équipe | messagerie instantanée |
| `/ws/notifications/?jeton=…` | client ou équipe | messages non lus en direct |

## Performance (objectif : pages légères, affichage en moins d'une seconde)

- Images éclaircies et converties en **WebP** (10 à 40 Ko chacune) ; tailles adaptées à l'écran
  (`srcset`), chargement différé hors de l'écran (`loading="lazy"`).
- Les images envoyées depuis le dashboard sont **converties automatiquement en WebP** par le back-end.
- Pages chargées **à la demande** (découpage du code par route) ; polices auto-hébergées.
- Image de la vidéo d'accueil **préchargée** ; vidéo en WebM (VP9) avec repli MP4.
- Accueil : un seul appel API pour tout le contenu (`/api/contenus/accueil/`).

## Sécurité

- Mots de passe hachés (PBKDF2), jamais stockés en clair.
- Jetons JWT courts (30 min) renouvelés automatiquement ; déconnexion = jeton révoqué.
- Connexion bloquée 15 minutes après 5 essais incorrects ; limites sur l'inscription et le contact.
- API du dashboard réservée aux comptes de l'équipe ; administration Django à une adresse cachée
  (`DJANGO_ADMIN_URL`).
- En production (`config.settings.prod`) : HTTPS obligatoire, HSTS, cookies sécurisés, PostgreSQL et
  Redis exigés.

## Modules à venir

Paiement par compte bancaire, appels (téléphonie locale Orange/MTN et internationale) et e-mails Gmail :
voir [docs/modules-a-venir.md](docs/modules-a-venir.md).

## Branches

- `main` : version stable.
- `prototype-1` : premier prototype (architecture, images, back-end, site public, tableau de bord).

## Pour un agent ou un nouveau développeur

Commencer par [CLAUDE.md](CLAUDE.md), puis [docs/contexte-projet.md](docs/contexte-projet.md) (décisions
prises avec le CIR) et le cahier des charges dans `docs/cahier-des-charges/`. Maquette téléphone de
référence : `docs/reference/maquette-telephone.html` (à ouvrir dans un navigateur).
