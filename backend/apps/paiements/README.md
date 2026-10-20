# Module `paiements` (back-end)

**Vague 4, Argent et pilotage** · Besoins : BF-10, BF-12

Paiement MTN et Orange Money avec CamPay après le contrat signé ; confirmation par webhook revérifiée auprès de l'API.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `transactions.py ; utilise integrations/campay/`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/paiements/` et API équipe `/api/admin/paiements/`
- [x] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
