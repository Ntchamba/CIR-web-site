# Module `devis` (back-end)

**Vague 2, Commande** · Besoins : BF-11, BF-12

Demande de rendu sur mesure et devis chiffré joint à une commande.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `calcul.py (surface × dosage × prix)`
- `pdf.py`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/devis/` et API équipe `/api/admin/devis/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
