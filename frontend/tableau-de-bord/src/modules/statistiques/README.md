# Module `statistiques` (tableau de bord)

**Vague 4, Argent et pilotage** · Besoins : BF-16

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Contrat : `docs/taches/vague-4-contrat-api.md` (API équipe `/api/admin/statistiques/`).

Fichiers :

- `StatistiquesPage.jsx` : période (7 jours, 30 jours, mois en cours, 12 mois, dates libres), cartes, « À traiter », évolution, répartitions, top produits.
- `composants/GraphiqueMois.jsx` : barres SVG sans bibliothèque + tableau équivalent masqué visuellement ; animation seulement sous `prefers-reduced-motion: no-preference`.
- `composants/CartesIndicateurs.jsx`, `ATraiter.jsx`, `Repartition.jsx` (cartes et blocs, réutilisés par l'accueil).
- `periode.js` (jours à l'heure de Douala, validation), `api.js`, `useStatistiques.js`, `Statistiques.module.css`, `Statistiques.test.jsx`.

Règles : les cartes d'argent n'existent que si le serveur envoie `montants` (super-administrateur) ; aucune donnée inventée.
L'accueil (`layout/AccueilPage.jsx`) lit `statistiques/resume/` et reste l'accueil d'avant si la réponse échoue.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).

- [x] Page Statistiques (période, cartes, « À traiter », répartitions, top produits)
- [x] Graphique SVG accessible (tableau équivalent)
- [x] Accueil branché sur `statistiques/resume/`
- [x] Textes dans les cinq langues, tests avec API simulée
