# Module `messagerie` (back-end)

**Vague 3, Échanges en direct** · Besoins : BF-11

Discussion en direct client ↔ équipe (WebSocket), pièces jointes, messages non lus.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `consumers.py`
- `routing.py`
- `pieces_jointes.py`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/messagerie/` et API équipe `/api/admin/messagerie/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
