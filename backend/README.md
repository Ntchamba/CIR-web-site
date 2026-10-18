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

## API (vague 1 : catalogue, vitrine, actualités, contenus)

Contrat détaillé (champs JSON exacts) : `docs/taches/vague-1-contrat-api.md`. Lecture publique sans
authentification (un jeton périmé est ignoré) ; API équipe réservée à `EstEquipe`. Les textes publics arrivent
dans la langue de `Accept-Language` (français en secours) ; l'API équipe renvoie les textes français,
`traductions` et `langues_incompletes`. En `multipart/form-data`, `traductions`, `caracteristiques`, `couches`
et `produits` sont des chaînes JSON. Médias : URL absolues ; images converties en WebP (refus 400 sur le champ
au-delà de 10 Mo ou 40 mégapixels) ; vidéos `.mp4` ou `.webm`, 50 Mo (vidéo de fond : 30 Mo). Un fichier
facultatif envoyé à `null` (JSON) ou vide (multipart) est retiré.

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/catalogue/familles/` | public : tableau `{id, nom, slug, description, nombre_produits}` |
| GET | `/api/catalogue/produits/` | public, paginé : `?famille=<slug>&usage=maison\|industrie\|entreprise\|exterieur&nouveau=1&a_la_une=1&search=` |
| GET | `/api/catalogue/produits/<slug>/` | public : fiche complète (404 si hors ligne) |
| GET, POST | `/api/admin/catalogue/familles/` | équipe (tableau simple) |
| GET, PATCH, PUT, DELETE | `/api/admin/catalogue/familles/<id>/` | équipe ; DELETE refusé (400) si la famille a des produits |
| GET, POST | `/api/admin/catalogue/produits/` | équipe, paginé : `?famille=<id>&en_ligne=1\|0&search=` |
| GET, PATCH, PUT, DELETE | `/api/admin/catalogue/produits/<id>/` | équipe ; `caracteristiques` et `couches` remplacées en entier |
| POST | `/api/admin/catalogue/produits/<id>/images/` et `/designs/` | équipe (multipart) |
| GET, PATCH, DELETE | `/api/admin/catalogue/images/<id>/` et `/designs/<id>/` | équipe |
| GET | `/api/vitrine/realisations/` (`?type=`), `/realisations/<slug>/` | public, paginé |
| GET | `/api/vitrine/demos/` | public, paginé (`integration` : adresse YouTube sans cookies ou Vimeo) |
| GET | `/api/vitrine/temoignages/` | public, paginé (publiés seulement) |
| POST | `/api/vitrine/temoignages/` | client connecté (pas l'équipe) : `{texte, note, ville?, type_chantier?}` → 201 « en_attente » ; 5 par 24 h (429) |
| GET | `/api/vitrine/temoignages/miens/` | connecté : ses témoignages avec `statut` et `motif_refus` |
| CRUD | `/api/admin/vitrine/realisations/`, `/api/admin/vitrine/demos/` | équipe (multipart) |
| GET, DELETE | `/api/admin/vitrine/temoignages/` (`?statut=`), `/<id>/` | équipe |
| POST | `/api/admin/vitrine/temoignages/<id>/publier/`, `/<id>/refuser/` `{motif?}` | équipe |
| GET | `/api/actualites/` (`?taille=3`), `/api/actualites/<slug>/` | public, paginé (publiées, date passée) |
| CRUD | `/api/admin/actualites/` | équipe (multipart) ; `programmee` en lecture |
| GET | `/api/contenus/accueil/` | public : accueil complet (coordonnées, bandeaux actifs, sphère) |
| GET, PATCH | `/api/admin/contenus/accueil/` | équipe (multipart possible) |
| CRUD | `/api/admin/contenus/bandeaux/`, `/api/admin/contenus/sphere/` | équipe (tableaux simples) ; bandeaux : `debut`, `fin` en dates `AAAA-MM-JJ`, fin incluse (jour de Douala), `fin == debut` accepté |
| POST | `/api/admin/contenus/sphere/ordre/` `{ids: [...]}` | équipe |

Données de référence du catalogue (idempotent, sans prix ni image) : `python manage.py charger_catalogue_reference`.
Les coordonnées initiales de l'accueil sont créées par la migration `contenus.0002_coordonnees_initiales`.

## API (vague 2 : sélection, commandes, devis, contact)

Contrat : `docs/taches/vague-2-contrat-api.md`. Règles métier dans les `services.py` (et `commandes/etapes.py`,
`negociation.py`, `contrats.py`, `devis/calcul.py`). Routes client = rôle `client` (403 `compte_equipe` pour l'équipe) ;
l'objet d'un autre client donne 404. Références `CIR-/DEV-/REN-/CTC-AAAA-NNNN` (compteur `noyau.CompteurReference`).

| Méthode | Route | Rôle |
|---|---|---|
| GET, POST, DELETE | `/api/selection/`, `resume/`, `<id>/` | sélection du client (50 éléments au plus) |
| GET, POST | `/api/commandes/` | liste, création (403 `adresse_incomplete`, quota 5/jour) |
| GET, PATCH | `/api/commandes/<id>/` | détail (`actions_possibles`, `peut_repondre`), correction en « Nouvelle » |
| POST | `/api/commandes/<id>/annuler/`, `propositions/`, `propositions/<pid>/accepter|refuser/` | étapes et négociation |
| GET | `/api/admin/commandes/`, `resume/`, `<id>/` | équipe (`?etat= ?type= ?search= ?client= ?action_requise=1`) |
| PATCH, POST | `/api/admin/commandes/<id>/`, `etat/`, `propositions/…` | surface, notes internes, travaux/terminée/annulée, négociation |
| GET, POST | `/api/devis/demandes-rendu/`, `<id>/` | demandes de rendu (multipart, 5 images WebP, quota 5/jour) |
| GET | `/api/devis/`, `<id>/` | devis reçus (jamais les brouillons), lecture seule |
| GET, POST, PATCH, DELETE | `/api/admin/devis/`, `<id>/` | devis (modifiable seulement en brouillon, lignes remplacées en entier) |
| POST | `/api/admin/devis/calculer/`, `<id>/envoyer/` | aperçu du calcul ; envoi = proposition de l'équipe |
| GET, PATCH | `/api/admin/devis/demandes-rendu/`, `resume/`, `<id>/` | boîte de réception des demandes de rendu |
| POST | `/api/contact/demandes/` | public (champ piège `site_web`, 5/heure/IP, 10/jour/compte) |
| GET | `/api/contact/demandes/miennes/` | suivi du client connecté |
| GET, PATCH | `/api/admin/contact/demandes/`, `resume/`, `<id>/` | boîte de réception de l'équipe |

Lignes de devis, API équipe : `libelle` brut + `libelle_affiche` (nom traduit du produit si vide) ; API client : `libelle` affiché. Montants plafonnés à 2 147 483 647 FCFA (400).

### Médias en production

`DJANGO_MEDIA_ROOT` : dossier des fichiers envoyés (volume Railway, ex. `/data/media`). Si
`DJANGO_SERVIR_MEDIAS` est vrai (défaut), Django sert `/media/` avec `Cache-Control: public, max-age=2592000`.

## Déploiement (Railway)

Service avec racine `/backend` et fichier de configuration `/backend/railway.toml` :
migrations en pré-déploiement, `collectstatic` puis `daphne` au démarrage, sonde sur `/api/sante/`.
Variables : `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`, `DATABASE_URL`
(référence au service PostgreSQL), `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`,
`CORS_ALLOWED_ORIGINS`, `DJANGO_MEDIA_ROOT` (volume), et de préférence `REDIS_URL`.
