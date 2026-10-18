# Module `devis` (back-end)

**Vague 2, Commande** · Besoins : BF-11, BF-12

Demande de rendu sur mesure et devis chiffré joint à une commande.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `calcul.py (surface × dosage × prix)`
- `pdf.py` : reporté (pas de PDF dans la vague 2 : devis et contrat s'affichent à l'écran, feuille d'impression)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/devis/` et API équipe `/api/admin/devis/`
- [x] Permissions
- [x] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
