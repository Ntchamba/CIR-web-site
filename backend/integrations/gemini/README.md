# Intégration `gemini` : Assistant IA via l'API Gemini

**Vague 5, Intelligence artificielle** · Agent `integrations`, vérifié par `integrations-testeur`.

Seul endroit du code qui parle à ce service. Le reste de l'application passe par ces fichiers ;
changer de prestataire ne doit toucher que ce dossier.

- `client.py (GEMINI_API_KEY, GEMINI_MODELE_ASSISTANT, GEMINI_MODELE_FOND)`
- `outils.py (déclaration des fonctions appelables)`

Règles : clés lues dans les variables d'environnement, jamais dans le code ; appels réseau
simulés (mock) dans les tests.

## Tâches

- [x] `erreurs.py` : `GeminiNonConfigure`, `GeminiErreurTemporaire`, `GeminiErreurDefinitive`, `GeminiContenuBloque`
- [x] `outils.py` : `declarer(nom, description, parametres)` (nom contrôlé, schéma simple vers format Gemini)
- [x] `client.py` : `configure()` et `generer(...)` (clé dans l'en-tête, aucun appel de fonction exécuté)
- [x] Tests (réseau simulé, `socket.socket` bloqué, aucun secret ni texte d'utilisateur dans erreurs et journaux)
- [ ] Vérifier le format réel de l'API Gemini avec une vraie clé (réserve : non vérifié sans réseau)
