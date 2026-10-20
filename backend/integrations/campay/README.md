# Intégration `campay` : Paiements MTN et Orange Money

**Vague 4, Argent et pilotage** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `client.py (initCollect, statut, lien de paiement)`
- `webhooks.py (clé du webhook + revérification auprès de l'API)`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.

## Tâches

- [x] `erreurs.py` : `CampayNonConfigure`, `CampayErreurTemporaire`, `CampayErreurDefinitive` (attribut `code`)
- [x] `telephone.py` : `normaliser`, `masquer`, `TelephoneInvalide`
- [x] `client.py` : `configure`, jeton en cache (un essai après 401), `initier_collecte`, `lien_paiement`, `statut`
- [x] `webhooks.py` : `verifier_signature` (JWT HS256, `CAMPAY_WEBHOOK_KEY`) et `analyser`
- [x] Tests (réseau simulé, `socket.socket` bloqué, aucun secret dans les erreurs ni les journaux)
- [ ] Vérifier le format réel des webhooks CamPay avec le compte de démonstration (réserve)
