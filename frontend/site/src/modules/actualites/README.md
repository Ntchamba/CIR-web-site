# Module `actualites` (site public)

**Vague 1, Vitrine** · Besoins : BF-07 · Routes : `/actualites`, `/actualites/:slug`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `ActualitesPage.jsx` : liste, « Voir plus », état vide
- [x] `ActualitePage.jsx` : date, image, texte en paragraphes, produit lié ; 404 → « Actualité introuvable »
- [x] `composants/SectionActualites.jsx` (sur l'accueil : 3 dernières, rien si aucune), `CarteActualite.jsx`
- [x] `api.js`, `useActualites.js` (`useActualites`, `useDernieresActualites`, `useActualite`), `Actualites.module.css`
- [x] Tests `ActualitesPage.test.jsx` (agent `site`, à compléter par `site-testeur`)

API : `GET /api/actualites/?page=&taille=`, `GET /api/actualites/<slug>/` ; dates via `date()` de `@partage/utils/format.js`.
