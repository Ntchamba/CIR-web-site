# Module `commandes` (back-end)

**Vague 2, Commande** · Besoins : BF-10, BF-12, BF-13, BF-16

Commande maison, industrie ou entreprise ; étapes ; propositions et contre-propositions jusqu'au contrat signé.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `etapes.py (Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée, + Annulée)`
- `negociation.py`
- `contrats.py`
- `signals.py` (proposition_acceptee / refusee / remplacee) et `extensions.py` (point d'extension pour `devis`, sans import à l'envers)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/commandes/` et API équipe `/api/admin/commandes/`
- [x] Permissions
- [x] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
