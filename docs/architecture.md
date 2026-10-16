# Architecture du prototype 2

Document de référence (dossiers, modules, fichiers, architecture agentique) :
https://claude.ai/code/artifact/913deb20-0cfd-4f00-827b-0e56e1348d2e

Résumé : un monorepo avec `backend/` (Django + DRF + Channels), `frontend/site/`, `frontend/tableau-de-bord/`,
`frontend/partage/`, `agents/` (IA Gemini), `infra/`, `docs/`. Un module = une fonctionnalité du cahier des
charges, avec le même nom côté back-end et front-end. Les fiches de tâches sont dans `docs/taches/`.
