# Agents IA de l'application (API Gemini)

- `prompts/` : `conseiller.md` (assistant client), `fond.md` (brouillons pour l'équipe)
- `connaissances/` : faits du projet ajoutés aux consignes du conseiller (le catalogue vient des outils, en base)
- `evaluations/` : `questions.json` (cas types et attendus), `rapports/` (non versionnés)

Vague 5. Ne pas confondre avec `.claude/agents/`, qui décrit les agents Claude qui codent le projet.

## Évaluer l'assistant (à la main, avant chaque mise en ligne)

    cd backend
    python manage.py evaluer_assistant            # nécessite GEMINI_API_KEY, jamais lancé par les tests
    python manage.py evaluer_assistant --cas ev-12 --langue en

Chaque cas : `{id, langue, question, contexte?, attendu: {doit, ne_doit_pas, outils?}}`. `doit` et `ne_doit_pas`
sont des listes de motifs : un motif est un texte (variantes séparées par `|`, casse ignorée) ou un marqueur :
`@proposer_contact` (boutons « écrire à l'équipe »), `@aucun_montant` (aucun montant dans la réponse),
`@aucun_lien` (aucune adresse), `@bloque` (un garde-fou est intervenu). Le rapport est écrit dans
`evaluations/rapports/` et une relecture humaine reste nécessaire.

Le serveur lit ce dossier via `ASSISTANT_AGENTS_DIR` (défaut : `agents/` à la racine du dépôt).
