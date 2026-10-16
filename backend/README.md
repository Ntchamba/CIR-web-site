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

## Langues (fiche `docs/decisions/7-multilingue.md`)

- L'API répond dans la langue de l'en-tête `Accept-Language` (`fr` par défaut, `en`, `zh-hans`, `de`, `ja`) :
  `LocaleMiddleware`, messages de Django et DRF déjà traduits, messages du CIR dans `locale/*/LC_MESSAGES/django.po`.
- Après avoir ajouté ou modifié un message `_("…")` : le traduire dans les quatre `.po`, puis
  `python manage.py compiler_traductions` (sans gettext ; `--verifier` pour contrôler seulement).
- `apps/noyau/langues.py` : codes courts (`fr, en, zh, de, ja`) ↔ codes Django (`zh-hans`), `langue_active()`.
- `apps/noyau/traductions.py` : traduction du contenu saisi par l'équipe (champ JSON `traductions`), voir son en-tête.

## Réglages

- `config/settings/dev.py` (par défaut pour `manage.py`) : SQLite, DEBUG.
- `config/settings/prod.py` (par défaut pour `asgi.py` et `wsgi.py`) : exige `DJANGO_SECRET_KEY`
  (≥ 50 caractères) et `DATABASE_URL`, HTTPS obligatoire, fichiers statiques servis par WhiteNoise.
- Toutes les variables sont listées dans `.env.example`.

## API (vague 0)

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/sante/` | public |
| POST | `/api/comptes/inscription/` | public : `email, mot_de_passe, nom_complet, telephone?, ville, quartier, rue_ou_repere, langue?` (défaut : langue de la requête) → `{utilisateur, acces, rafraichissement}` |
| POST | `/api/comptes/connexion/` | public : `email, mot_de_passe` → `{acces, rafraichissement, utilisateur}` ; blocage 15 min après 5 échecs |
| POST | `/api/comptes/connexion/rafraichir/` | `rafraichissement` → `{acces, rafraichissement}` |
| POST | `/api/comptes/deconnexion/` | `rafraichissement` (mis en liste noire) |
| GET, PATCH, PUT | `/api/comptes/moi/` | connecté (nom, téléphone, adresse, `langue` modifiables) |
| POST | `/api/admin/comptes/connexion/` | connexion du tableau de bord (refusée aux clients, 403) |
| GET, POST | `/api/admin/comptes/equipe/` | super-admin : liste, ajout (`email, nom_complet, mot_de_passe, telephone?, role?, langue?`) |
| GET | `/api/admin/comptes/equipe/<id>/` | super-admin |
| POST | `/api/admin/comptes/equipe/<id>/desactiver/` et `/reactiver/` | super-admin |
| GET | `/api/admin/comptes/clients/` et `/<id>/` | équipe ; `?search=`, `?ville=`, `?is_active=`, `?adresse_complete=1/0`, `?taille=` |

### Sécurité de la connexion et des quotas

- **Blocage après 5 échecs (BNF-01)** : le compteur est **par e-mail** (`cir:connexion:<email>`),
  quelle que soit l'adresse IP, pendant 15 minutes. Il est **partagé entre la connexion publique et
  celle du tableau de bord** : 5 échecs sur l'une bloquent aussi l'autre pour cet e-mail. Un second
  compteur par adresse IP bloque après 20 échecs (tous comptes confondus). Une connexion réussie remet
  le compteur de l'e-mail à zéro. Les compteurs vivent dans le cache : utiliser Redis (`REDIS_URL`)
  en production pour qu'ils soient communs à tous les processus.
- **`DJANGO_NOMBRE_PROXIES`** (`REST_FRAMEWORK["NUM_PROXIES"]`) : nombre de proxys de confiance devant
  l'application. L'adresse du client est la valeur ajoutée par le dernier proxy dans `X-Forwarded-For`
  (les valeurs placées avant par le client sont ignorées). Défaut : `1` en production (Railway), `0` en
  développement et en tests (`REMOTE_ADDR`, en-tête ignoré). Sert au quota d'inscription (20 par heure
  et par adresse) et au compteur de connexion par IP.
- **Images** : `apps/noyau/images.py` refuse les fichiers de plus de 10 Mo ou 40 mégapixels
  (`ImageInvalide`) avant de les décoder.

En-tête d'authentification : `Authorization: Bearer <acces>`. Listes paginées : `{count, next, previous, results}`.

## Déploiement (Railway)

Service avec racine `/backend` et fichier de configuration `/backend/railway.toml` :
migrations en pré-déploiement, `collectstatic` puis `daphne` au démarrage, sonde sur `/api/sante/`.
Variables : `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`, `DATABASE_URL`
(référence au service PostgreSQL), `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
`CORS_ALLOWED_ORIGINS`, et de préférence `REDIS_URL`.
