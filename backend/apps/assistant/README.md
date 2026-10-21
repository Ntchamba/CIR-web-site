# Module `assistant` (back-end)

**Vague 5, Intelligence artificielle** · Besoins : O1, O4

Agents IA (API Gemini) : assistant client avec outils en lecture seule, agent de fond qui prépare des brouillons pour l'équipe.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `orchestrateur.py`
- `outils.py`
- `garde_fous.py`
- `journal.py ; utilise integrations/gemini/`
- `evaluations.py` et les commandes `purger_assistant` (rétention, aussi appelée par le worker) et `evaluer_assistant` (manuelle, vraie clé)
- `agents/` à la racine du dépôt : prompts, connaissances, évaluations (variable `ASSISTANT_AGENTS_DIR`)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/assistant/` et API équipe `/api/admin/assistant/`
- [x] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
