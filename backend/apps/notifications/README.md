# Module `notifications` (back-end)

**Vague 3, Échanges en direct** · Besoins : BF-07, BF-13

E-mails avec l'API Gmail, notifications internes, modèles de messages.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `evenements.py (qui reçoit quoi)`
- `taches.py (envoi différé) ; utilise integrations/gmail/`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/notifications/` et API équipe `/api/admin/notifications/`
- [x] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
