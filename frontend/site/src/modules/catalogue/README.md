# Module `catalogue` (site public)

**Vague 1, Vitrine** · Besoins : BF-01, BF-05, BF-06, BF-14 · Route : `/catalogue`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `CataloguePage.jsx` : filtres, grille de cartes, « Voir plus », états vide / sans résultat / erreur
- [x] `composants/Filtres.jsx` : recherche, famille (avec nombre de produits), usage (boutons `aria-pressed`) ;
  critères dans l'adresse (`?famille=&usage=&q=`, lien partageable)
- [x] `composants/CarteProduit.jsx` : vignette, famille, référence, nom, accroche, usages, prix
  (`prix()` de `@partage/utils/format.js` → « Prix sur devis » si absent) ; aussi utilisée sur l'accueil
- [x] `api.js` (`familles`, `produits`, `requete`), `useCatalogue.js`, `usages.js`, `Catalogue.module.css`
- [x] Tests `CataloguePage.test.jsx` (agent `site`, à compléter par `site-testeur`)

API : `GET /api/catalogue/familles/`, `GET /api/catalogue/produits/?famille=&usage=&search=&page=`
(requêtes publiques sans jeton, `Accept-Language` de l'interface ; rechargées au changement de langue).
