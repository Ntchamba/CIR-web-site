# Module `catalogue` (back-end)

**Vague 1, Vitrine** · Besoins : BF-01, BF-05, BF-06, BF-14

Familles, produits, designs, prix ou « Prix sur devis », fiche technique, plan de coupe (couches).

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `filtres.py (famille, type de bâtiment)`
- `prix.py (prix facultatif, unité)`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/catalogue/` et API équipe `/api/admin/catalogue/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
