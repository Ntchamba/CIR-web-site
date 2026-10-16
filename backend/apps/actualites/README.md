# Module `actualites` (back-end)

**Vague 1, Vitrine** · Besoins : BF-07

Nouveautés et autres produits de l'entreprise.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- (aucun)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/actualites/` et API équipe `/api/admin/actualites/`
- [x] Permissions
- [x] Multilingue : titre, résumé et texte traduits ; programmation (`publie_le` futur, `programmee`)
- [ ] Tests unitaires et d'API (tests de base écrits par `backend` ; à compléter et valider par `backend-testeur`)
