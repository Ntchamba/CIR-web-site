# Module `produit` (site public)

**Vague 1, Vitrine** · Besoins : BF-01, BF-05, BF-06, BF-14 · Route : `/catalogue/:slug`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `ProduitPage.jsx` : retour au catalogue, galerie, résumé, options, fiche technique, plan de coupe ; 404 → « Produit introuvable »
- [x] `composants/Galerie.jsx` : grande image prioritaire, vignettes (boutons `aria-pressed`)
- [x] `composants/PanneauOptions.jsx` : prix, designs (boutons radio : image ou couleur), « Appeler » et
  « WhatsApp » (message prérempli avec le produit et le design) en attendant la sélection et la commande (vague 2)
- [x] `composants/FicheTechnique.jsx` : présentation, domaine d'application, performances, mise en œuvre,
  tableau des indicateurs ; seules les rubriques renseignées sont affichées
- [x] `composants/PlanCoupe.jsx` : liste ordonnée des couches (surface → support), lisible par les lecteurs d'écran
- [x] `api.js`, `useProduit.js`, `Produit.module.css`
- [x] Tests `ProduitPage.test.jsx` (agent `site`, à compléter par `site-testeur`)

API : `GET /api/catalogue/produits/<slug>/` (rechargé au changement de langue). Coordonnées des boutons :
`useCoordonnees()` de `layout/contenus.js`.
