# Module `catalogue` (back-end)

**Vague 1, Vitrine** · Besoins : BF-01, BF-05, BF-06, BF-14

Familles, produits, designs, prix ou « Prix sur devis », fiche technique, plan de coupe (couches).

## Fichiers

Gabarit commun : models.py, serializers.py, views.py, views_admin.py, urls.py, urls_admin.py, services.py, permissions.py, admin.py, migrations/, tests/ (test_models.py, test_api.py, test_services.py)

Fichiers propres au module :

- `filtres.py` (famille, usage, nouveauté, à la une, recherche)
- `prix.py` (prix facultatif en FCFA, unité, champ `ChampPrix`)
- `management/commands/charger_catalogue_reference.py` (données de référence du cahier des charges)

## Tâches (agent `backend`, vérifiées par `backend-testeur`)

- [x] Modèles et migrations
- [x] Règles métier dans `services.py` (jamais dans les vues)
- [x] API publique `/api/catalogue/` et API équipe `/api/admin/catalogue/`
- [x] Permissions
- [x] Multilingue : champs traduits (`TraductionsMixin`), API publique dans la langue de `Accept-Language`,
  API équipe avec `traductions` et `langues_incompletes` (objets imbriqués compris)
- [x] Commande `python manage.py charger_catalogue_reference` (9 familles, 9 produits de référence, sans prix ni image)
- [ ] Tests unitaires et d'API (tests de base écrits par `backend` ; à compléter et valider par `backend-testeur`)
