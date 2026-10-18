# Module `selection` (site public)

**Vague 2, Commande** · Besoins : BF-09 · Route : `/selection` (protégée)

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `SelectionContext.jsx` : `SelectionProvider` (dans `App`, chargé seulement pour un client connecté), `useSelection()` → `{ disponible, nombre, produits, estSelectionne, ajouter, retirer, vider, rafraichir }`
- [x] `composants/BoutonSelection.jsx` : carte produit et fiche produit (visiteur → connexion avec `?suite=`, équipe → aucun bouton)
- [x] `SelectionPage.jsx` : liste, retrait, vidage confirmé, produit hors ligne signalé, lien vers la commande
- [x] `api.js`, `useSelection.js`, `Selection.module.css` ; compteur dans l'en-tête
- [x] Tests `SelectionPage.test.jsx`

API : `GET /api/selection/`, `GET /api/selection/resume/`, `POST /api/selection/`, `DELETE /api/selection/<id>/` et `DELETE /api/selection/`.
