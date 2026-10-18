# Module `devis` (site public)

**Vague 2, Commande** · Besoins : BF-11, BF-12 · Routes : `/devis/demande` (protégée) ; devis dans `/commandes/:id`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `composants/ApercuDevis.jsx` : devis envoyés (lignes à la demande, expiré, feuille d'impression, lien vers la négociation)
- [x] `DemandeRenduPage.jsx` + `composants/ApercusImages.jsx` : description, type, surface, produit de référence, commande liée, 5 photos au plus avec aperçu ; succès → `/mes-demandes`
- [x] `api.js`, `useDevis.js`, `Devis.module.css` ; impression par `src/composants/imprimer.js` et `styles/global.css`
- [x] Tests `devis.test.jsx`

API : `GET /api/devis/<id>/`, `GET|POST /api/devis/demandes-rendu/` (multipart). Le calcul des montants reste côté serveur.
