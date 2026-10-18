# Module `devis` (tableau de bord)

**Vague 2, Commande** · Besoins : BF-11, BF-12

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- [x] `DevisPage.jsx` : onglets Devis et Demandes de rendu (tiroir de détail, réponse, état, notes, « Créer un devis »)
- [x] `EditeurDevis.jsx` : 3 types de ligne, aperçu par `POST calculer/` (la formule n'est jamais recopiée), erreurs par ligne, prix du catalogue seulement s'il existe, envoi avec confirmation, lecture seule hors brouillon
- [x] `api.js`, `lignes.js`, `useDevis.js`, `Devis.module.css`, `composants/`
- [x] Tests : `Devis.test.jsx`

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
