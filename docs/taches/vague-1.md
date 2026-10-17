# Vague 1 : Vitrine

Contrat d'API commun aux trois agents : `docs/taches/vague-1-contrat-api.md`.

Chaque paire travaille dans sa propre fenêtre de contexte : l'agent code, puis son agent testeur relit le code, écrit et lance les tests unitaires, et renvoie ses remarques jusqu'à ce que tout passe.

## Module `catalogue` (BF-01, BF-05, BF-06, BF-14)
- [x] Back-end : paire `backend` + `backend-testeur`
- [x] Site : paire `site` + `site-testeur`
- [x] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `vitrine` (BF-02, BF-03, BF-04, BF-15)
- [x] Back-end : paire `backend` + `backend-testeur`
- [x] Site : paire `site` + `site-testeur`
- [x] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `actualites` (BF-07)
- [x] Back-end : paire `backend` + `backend-testeur`
- [x] Site : paire `site` + `site-testeur`
- [x] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `contenus` (BF-15, O2)
- [x] Back-end : paire `backend` + `backend-testeur`
- [x] Site : paire `site` + `site-testeur`
- [x] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`


Une branche et une pull request par vague (ou par module si la vague est grande), vers `prototype-2`.

## Multilingue (s'applique aux quatre modules)

- Chaque modèle dont le texte s'affiche sur le site (nom, description, légende, titre, texte…) utilise
  `TraductionsMixin` + `traductions = champ_traductions()` (`apps/noyau/traductions.py`) : le français dans
  les champs habituels, les autres langues dans `traductions`.
- API publique : `SerialiseurTraduitMixin` (textes dans la langue de la requête, français en secours).
  API du tableau de bord : `SerialiseurTraductionsAdminMixin` (champ `traductions` modifiable et contrôlé,
  `langues_incompletes` renvoyé).
- Tableau de bord : formulaires avec un onglet par langue (français obligatoire, autres facultatives) et une
  pastille « traductions à compléter ». Site : aucun texte en dur, tout passe par `t()`.
- Les prix, surfaces et dates passent par `@partage/utils/format.js` (formats de la langue choisie).

## Note de la vague 0

- `optimiser_champ_image` (module `noyau`) lève `ImageInvalide` (une `ValueError`) au-delà de 10 Mo ou
  40 mégapixels, ou pour un fichier illisible. Les sérialiseurs qui reçoivent des images (catalogue, vitrine,
  actualités) doivent la transformer en erreur de validation 400.
