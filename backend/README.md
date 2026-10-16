# Back-end CIR (Django 5.2)

API REST (Django REST Framework), JWT (simplejwt), WebSocket (Channels + daphne), PostgreSQL en
production et SQLite en développement. Modules dans `apps/<module>/` (voir `CLAUDE.md` à la racine).

## Lancer en local

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # puis adapter si besoin (rien d'obligatoire en dev)
python manage.py migrate
python manage.py createsuperuser     # premier super-administrateur (e-mail + mot de passe)
python manage.py runserver           # http://127.0.0.1:8000 (ASGI via daphne)
```

Tests : `python manage.py test`. Vérification : `curl http://127.0.0.1:8000/api/sante/`.

## Réglages

- `config/settings/dev.py` (par défaut pour `manage.py`) : SQLite, DEBUG.
- `config/settings/prod.py` (par défaut pour `asgi.py` et `wsgi.py`) : exige `DJANGO_SECRET_KEY`
  (≥ 50 caractères) et `DATABASE_URL`, HTTPS obligatoire, fichiers statiques servis par WhiteNoise.
- Toutes les variables sont listées dans `.env.example`.

## API (vague 0)

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/sante/` | public |
| POST | `/api/comptes/inscription/` | public : `email, mot_de_passe, nom_complet, telephone?, ville, quartier, rue_ou_repere` → `{utilisateur, acces, rafraichissement}` |
| POST | `/api/comptes/connexion/` | public : `email, mot_de_passe` → `{acces, rafraichissement, utilisateur}` ; blocage 15 min après 5 échecs |
| POST | `/api/comptes/connexion/rafraichir/` | `rafraichissement` → `{acces, rafraichissement}` |
| POST | `/api/comptes/deconnexion/` | `rafraichissement` (mis en liste noire) |
| GET, PATCH, PUT | `/api/comptes/moi/` | connecté (nom, téléphone, adresse modifiables) |
| POST | `/api/admin/comptes/connexion/` | connexion du tableau de bord (refusée aux clients, 403) |
| GET, POST | `/api/admin/comptes/equipe/` | super-admin : liste, ajout (`email, nom_complet, mot_de_passe, telephone?, role?`) |
| GET | `/api/admin/comptes/equipe/<id>/` | super-admin |
| POST | `/api/admin/comptes/equipe/<id>/desactiver/` et `/reactiver/` | super-admin |
| GET | `/api/admin/comptes/clients/` et `/<id>/` | équipe ; `?search=`, `?ville=`, `?is_active=`, `?adresse_complete=1/0`, `?taille=` |

En-tête d'authentification : `Authorization: Bearer <acces>`. Listes paginées : `{count, next, previous, results}`.

## Déploiement (Railway)

Service avec racine `/backend` et fichier de configuration `/backend/railway.toml` :
migrations en pré-déploiement, `collectstatic` puis `daphne` au démarrage, sonde sur `/api/sante/`.
Variables : `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`, `DATABASE_URL`
(référence au service PostgreSQL), `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
`CORS_ALLOWED_ORIGINS`, et de préférence `REDIS_URL`.
