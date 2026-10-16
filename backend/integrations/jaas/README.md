# Intégration `jaas` : Appels Jitsi as a Service

**Vague 3, Échanges en direct** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `jetons.py (JWT JaaS, rôle modérateur)`
- `webhooks.py`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.
