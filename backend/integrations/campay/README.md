# Intégration `campay` : Paiements MTN et Orange Money

**Vague 4, Argent et pilotage** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `client.py (initCollect, statut, lien de paiement)`
- `webhooks.py (clé du webhook + revérification auprès de l'API)`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.
