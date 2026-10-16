# Module `statistiques` (back-end)

**Vague 4, Argent et pilotage** · Besoins : BF-16

Indicateurs du tableau de bord : commandes, chiffre, demandes en attente.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `indicateurs.py`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/statistiques/` et API équipe `/api/admin/statistiques/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
