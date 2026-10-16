# Module `accueil` (site public)

**Vague 1, Vitrine** · Besoins : BF-15, O2 · Route : `/`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `AccueilPage.jsx` : bandeaux, haut de page, usages, produits à la une, dernières actualités
  (`actualites/composants/SectionActualites.jsx`), aperçu des réalisations, partenaire Jiuye
- [x] `composants/Hero.jsx` : titre, accroche (textes par défaut traduits si l'équipe n'a rien saisi), boutons
- [x] `composants/VideoFond.jsx` : vidéo jouée une fois, sans son, décorative ; affiche seule si
  `prefers-reduced-motion` ou économie de données (`app/preferences.js`)
- [x] `composants/Sphere.jsx` : photos en sphère 3D (pause au survol et au focus, clic → produit lié ou catalogue) ;
  grille simple si mouvement réduit ou moins de 4 photos ; aucune photo par défaut inventée
- [x] `composants/Bandeaux.jsx` (liens internes seulement), `Usages.jsx` (catalogue filtré par usage),
  `ProduitsALaUne.jsx`, `ApercuRealisations.jsx`, `Partenaire.jsx`
- [x] `api.js`, `useAccueil.js`, `Accueil.module.css`
- [x] Tests `AccueilPage.test.jsx` (agent `site`, à compléter par `site-testeur`)

API : `GET /api/contenus/accueil/` (une requête par langue, partagée avec l'en-tête et le pied de page :
`layout/contenus.js`), `GET /api/catalogue/produits/?a_la_une=1&taille=6`, `GET /api/actualites/?taille=3`,
`GET /api/vitrine/realisations/?taille=3`. Une section sans données n'est pas affichée.
