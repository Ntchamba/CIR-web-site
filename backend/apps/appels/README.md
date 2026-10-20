# Module `appels` (back-end)

**Vague 3, Échanges en direct** · Besoins : BF-11

Appels audio ou vidéo dans l'application avec Jitsi (JaaS) ; sonnerie côté équipe par WebSocket.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `salles.py (création de salle, sonnerie) ; utilise integrations/jaas/`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/appels/` et API équipe `/api/admin/appels/`
- [x] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
