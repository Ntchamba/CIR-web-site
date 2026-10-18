# Module `commandes` (tableau de bord)

**Vague 2, Commande** · Besoins : BF-10, BF-12, BF-13, BF-16

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- [x] `CommandesPage.jsx` : onglets par étape avec nombres (`resume/`), recherche, filtre « action requise », tableau paginé
- [x] `DetailCommande.jsx` : client (`tel:`, `mailto:`, langue), adresse, lignes, surface modifiable, frise et boutons selon `actions_possibles`, négociation selon `peut_repondre`, devis liés, contrat
- [x] `NotesInternes.jsx` : placé dans `src/composants/` (partagé avec devis et contact), enregistrement explicite
- [x] `api.js`, `useCommandes.js`, `Commandes.module.css`, `composants/` (`FriseEtapes`, `PanneauNegociation`, `FormulaireProposition`, `DevisLies`, `ContratCommande`)
- [x] Tests : `Commandes.test.jsx`

Les transitions ne se déduisent jamais côté front ; `negociation` et `contrat_signe` ne se posent jamais à la main.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
