# Infrastructure

- `docker-compose.yml` : PostgreSQL et Redis en local
- `scripts/` : `sauvegarde_bdd.sh`, `donnees_demo.py`
- Déploiement : un service Railway par application, chacun avec son `railway.toml` et ses « watch paths ».
  - `backend/` : root directory `/backend`, configuration `/backend/railway.toml`.
  - `frontend/site/` et `frontend/tableau-de-bord/` : root directory **vide** (ils importent `frontend/partage/`),
    configuration `/frontend/<app>/railway.toml`, build par le Dockerfile de l'application.
