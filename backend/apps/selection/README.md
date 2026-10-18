# Module `selection` (back-end)

**Vague 2, Commande** · Besoins : BF-09

Liste des produits et designs choisis par le client, qui alimente la commande.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- (aucun)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/selection/` et API équipe `/api/admin/selection/`
- [x] Permissions
- [x] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
