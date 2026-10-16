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
- `medias.py` (vague 1 : URL absolues, objet image `{url, alt}`, `preparer_images` → 400 sur le champ,
  `valider_video` (.mp4/.webm, 50 Mo), `servir_media` pour `/media/` avec cache)
- `champs.py` (vague 1 : listes et identifiants envoyés en chaîne JSON dans un formulaire multipart)
- `slugs.py` (vague 1 : `slug_unique`)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations (aucun modèle : module utilitaire)
- [x] Utilitaires : `pagination.py`, `images.py` (WebP), `permissions.py` (pas de `services.py` nécessaire)
- [x] API publique : `GET /api/sante/` (`sante.py`) ; pas d'API équipe pour ce module
- [x] Permissions (`EstEquipe`, `EstSuperAdmin`, `LectureSeule`)
- [ ] `sitemap.py` (plan du site : quand catalogue, vitrine et actualités existeront)
- [x] Tests unitaires et d'API (écrits et lancés par `backend-testeur`)
