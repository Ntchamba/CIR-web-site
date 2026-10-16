# Module `comptes` (back-end)

**Vague 0, Socle** · Besoins : BF-08, BF-17, BNF-01, BNF-06

Inscription avec adresse, connexion JWT, profil, rôles (client, membre, super-admin), gestion de l'équipe.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `jwt.py (jetons d'accès et de rafraîchissement)`
- `adresses.py (adresse complète obligatoire)`
- `roles.py`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/comptes/` et API équipe `/api/admin/comptes/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
