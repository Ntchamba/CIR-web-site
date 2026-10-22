# Infrastructure

- Pas de `docker-compose.yml` ni de scripts fournis pour l'instant : en local, SQLite suffit (rien à installer) ;
  pour essayer PostgreSQL ou Redis, les installer sur la machine et renseigner `DATABASE_URL` et `REDIS_URL`.
- Aucune donnée de démonstration n'est chargée : le catalogue de départ vient de `python manage.py charger_catalogue_reference`
  et les médias de `python manage.py importer_medias_reference` (voir `README.md` à la racine).
- Déploiement : un service Railway par application, chacun avec son `railway.toml` et ses « watch paths ».
  - `backend/` : root directory `/backend`, configuration `/backend/railway.toml`.
  - `frontend/site/` et `frontend/tableau-de-bord/` : root directory **vide** (ils importent `frontend/partage/`),
    configuration `/frontend/<app>/railway.toml`, build par le Dockerfile de l'application.
