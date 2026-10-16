# Module `noyau` (back-end)

**Vague 0, Socle** · Besoins : BNF-02 à BNF-10

Socle commun : permissions, pagination, conversion des images en WebP, plan du site (sitemap) et santé du serveur.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `images.py (conversion WebP, tailles)`
- `pagination.py`
- `permissions.py (EstEquipe, EstSuperAdmin)`
- `sitemap.py`
- `sante.py (/api/sante/)`

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [ ] Modèles et migrations
- [ ] Règles métier dans `services.py` (jamais dans les vues)
- [ ] API publique `/api/noyau/` et API équipe `/api/admin/noyau/`
- [ ] Permissions
- [ ] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
