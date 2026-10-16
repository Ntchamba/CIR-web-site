# Module `vitrine` (back-end)

**Vague 1, Vitrine** · Besoins : BF-02, BF-03, BF-04, BF-15

Réalisations (avant/après), démos vidéo, témoignages avec modération.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `moderation.py (témoignages à valider)`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/vitrine/` et API équipe `/api/admin/vitrine/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
