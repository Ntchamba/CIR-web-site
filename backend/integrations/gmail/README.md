# Intégration `gmail` : E-mails via l'API Gmail

**Vague 3, Échanges en direct** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `client.py`
- `gabarits/ (modèles d'e-mails)`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.

## Tâches (vague 3)

- [x] `client.py` : `configure`, `MessageEmail`, `envoyer` (OAuth2, MIME UTF-8, anti-injection d'en-têtes), `rendre_gabarit`
- [x] `erreurs.py`, `gabarits/base.html` et `base.txt`
- [x] Tests dans `tests/` (`python -m unittest discover -s integrations/gmail/tests -t .` depuis `backend/`)
