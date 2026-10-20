# Module `paiements` (tableau de bord)

**Vague 4, Argent et pilotage** · Besoins : BF-10, BF-12

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Contrat : `docs/taches/vague-4-contrat-api.md` (API équipe `/api/admin/paiements/`).

Fichiers :

- `PaiementsPage.jsx` : liste filtrable (état, mode, recherche), pastille « À vérifier » pour les anomalies, résumé, volet de détail.
- `composants/TiroirPaiement.jsx` : détail (références, opérateur, raison traduite, dernière vérification), bouton « Revérifier ».
- `composants/BlocPaiements.jsx` : bloc « Paiements » de la fiche commande (convenu, payé, reste, statut, liste).
- `composants/RapprochementManuel.jsx` : règlement hors ligne (montant ≤ reste, mode, note, confirmation avant l'envoi).
- `composants/PastillesPaiement.jsx` : pastilles d'état d'un paiement et de statut d'une commande.
- `api.js`, `usePaiements.js` (trame `paiement_mis_a_jour` du direct), `Paiements.module.css`, `Paiements.test.jsx`.

Règles : le numéro de téléphone n'est jamais affiché en entier (seulement `telephone_masque`) ; aucun montant inventé.
Hors du module : colonne et filtre « paiement » dans `modules/commandes/`, pastille du menu dans `layout/usePastilles.js`.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).

- [x] Page Paiements (liste, filtres, volet, revérification)
- [x] Bloc Paiements et règlement hors ligne dans la fiche commande
- [x] Colonne et filtre « paiement » dans la liste des commandes
- [x] Pastille du menu et écoute de la trame `paiement_mis_a_jour`
- [x] Textes dans les cinq langues, tests avec API simulée
