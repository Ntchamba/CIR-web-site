# Intégration `jaas` : Appels Jitsi as a Service

**Vague 3, Échanges en direct** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `jetons.py (JWT JaaS, rôle modérateur)`
- `webhooks.py`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.

## Tâches (vague 3)

- [x] `jetons.py` : `configure`, `parametres_client`, `creer_jeton` (RS256, modérateur, aucune fonction payante)
- [x] `webhooks.py` : `verifier` (temps constant), `analyser`
- [x] `erreurs.py`, tests dans `tests/` (`python -m unittest discover -s integrations/jaas/tests -t .` depuis `backend/`)
