# Vague 1 : Vitrine

Chaque paire travaille dans sa propre fenêtre de contexte : l'agent code, puis son agent testeur relit le code, écrit et lance les tests unitaires, et renvoie ses remarques jusqu'à ce que tout passe.

## Module `catalogue` (BF-01, BF-05, BF-06, BF-14)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `vitrine` (BF-02, BF-03, BF-04, BF-15)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `actualites` (BF-07)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`

## Module `contenus` (BF-15, O2)
- [ ] Back-end : paire `backend` + `backend-testeur`
- [ ] Site : paire `site` + `site-testeur`
- [ ] Tableau de bord : paire `tableau-de-bord` + `tableau-de-bord-testeur`


Une branche et une pull request par vague (ou par module si la vague est grande), vers `prototype-2`.

## Note de la vague 0

- `optimiser_champ_image` (module `noyau`) lève `ImageInvalide` (une `ValueError`) au-delà de 10 Mo ou
  40 mégapixels, ou pour un fichier illisible. Les sérialiseurs qui reçoivent des images (catalogue, vitrine,
  actualités) doivent la transformer en erreur de validation 400.
