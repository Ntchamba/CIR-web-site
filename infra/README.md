# Infrastructure

- `docker-compose.yml` : PostgreSQL et Redis en local
- `scripts/` : `sauvegarde_bdd.sh`, `donnees_demo.py`
- Déploiement : un service Railway par application (`backend/`, `frontend/site/`, `frontend/tableau-de-bord/`),
  chacun avec son `railway.toml`, son « root directory » et ses « watch paths ».
