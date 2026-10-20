# Vague 3 : Échanges en direct

Chaque paire travaille dans sa propre fenêtre de contexte : l'agent code, puis son agent testeur relit le code, écrit et lance les tests unitaires, et renvoie ses remarques jusqu'à ce que tout passe.

## Module `messagerie` (BF-11)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `appels` (BF-11)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `notifications` (BF-07, BF-13)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Intégration `jaas`
- [ ] Paire `integrations` + `integrations-testeur`

## Intégration `gmail`
- [ ] Paire `integrations` + `integrations-testeur`


Une branche et une pull request par vague (ou par module si la vague est grande), vers `prototype-2`.


## Contrat d'API

Le contrat détaillé (WebSocket, API, intégrations, signaux, règles) est dans `docs/taches/vague-3-contrat-api.md`. Décision : `docs/decisions/8-echanges-en-direct.md`. Le client WebSocket commun `frontend/partage/api/socket.js` est fourni.
