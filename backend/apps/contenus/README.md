# Module `contenus` (back-end)

**Vague 1, Vitrine** · Besoins : BF-15, O2

Textes et médias de l'accueil : vidéo de fond (jouée une fois), sphère de photos, bandeaux.

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- (aucun)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/contenus/` et API équipe `/api/admin/contenus/`
- [x] Permissions
- [x] Multilingue : titre, accroche, texte partenaire, bandeaux et textes alternatifs traduits
- [x] Migration de données `0002_coordonnees_initiales` (trois téléphones, WhatsApp, adresse)
- [ ] Tests unitaires et d'API (tests de base écrits par `backend` ; à compléter et valider par `backend-testeur`)
