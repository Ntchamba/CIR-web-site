# Module `commandes` (back-end)

**Vague 2, Commande** · Besoins : BF-10, BF-12, BF-13, BF-16

Commande maison, industrie ou entreprise ; étapes ; propositions et contre-propositions jusqu'au contrat signé.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `etapes.py (Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée, + Annulée)`
- `negociation.py`
- `contrats.py`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/commandes/` et API équipe `/api/admin/commandes/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
