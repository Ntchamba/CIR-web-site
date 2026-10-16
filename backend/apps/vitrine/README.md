# Module `vitrine` (back-end)

**Vague 1, Vitrine** · Besoins : BF-02, BF-03, BF-04, BF-15

Réalisations (avant/après), démos vidéo, témoignages avec modération.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `moderation.py` (contrôle du texte, publication, refus des témoignages)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/vitrine/` et API équipe `/api/admin/vitrine/`
- [x] Permissions
- [x] Multilingue : réalisations et démos traduites ; témoignages non traduits (champ `langue`)
- [x] Modération (`moderation.py`) : 20 à 800 caractères, ni lien, ni e-mail, ni téléphone ; quota de 5 par jour
- [ ] Tests unitaires et d'API (tests de base écrits par `backend` ; à compléter et valider par `backend-testeur`)
