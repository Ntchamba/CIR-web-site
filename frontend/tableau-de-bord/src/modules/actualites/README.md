# Module `actualites` (tableau de bord)

**Vague 1, Vitrine** · Besoins : BF-07 · API : `/api/admin/actualites/`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `ActualitesPage.jsx` : liste (de la plus récente à la plus ancienne), pastilles « Publiée », « Programmée », « Non publiée »
- `composants/TiroirActualite.jsx` : titre, résumé (280), texte traduits ; image facultative ; produit lié ; publication et date (`datetime-local`, envoyée en ISO UTC ; vide = maintenant)
- `api.js`, `useActualites.js` (`etatActualite`), `Actualites.module.css`

Tâches :

- [x] Liste, création, modification, suppression avec confirmation
- [x] Programmation : date future → « Programmée » (champ `programmee` du serveur ou date future)
- [x] Erreurs 400 sous les champs, états de chargement et vides, `langues_incompletes`
- [x] Tests Vitest de base (`ActualitesPage.test.jsx`)
- [ ] Suite de tests complète (agent `tableau-de-bord-testeur`)
