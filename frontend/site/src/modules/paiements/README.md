# Module `paiements` (site public)

**Vague 4, Argent et pilotage** · Besoins : BF-10, BF-12

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `api.js` : client de `/api/paiements/` (disponibilité, liste, création, détail, annulation, reçu)
- [x] `usePaiements.js` : disponibilité, paiements d'une commande (trame `paiement_mis_a_jour`), suivi d'un paiement
  (direct + repli `GET <id>/` toutes les 4 s), reçu
- [x] `regles.js`, `navigation.js` : règles de saisie, `peutPayer`, adresse de redirection sûre (https ou http://localhost)
- [x] `composants/BlocPaiement.jsx` : bloc « Paiement » de `DetailCommande` (convenu, payé, reste, statut, liste, bouton « Payer »)
- [x] `composants/FormulairePaiement.jsx` : reste ou autre montant, Mobile Money ou lien, un seul envoi à la fois
- [x] `composants/SuiviPaiement.jsx` : attente (`role="status"`, USSD, compte à rebours indicatif) et états finaux
- [x] `PaiementPage.jsx` (`/commandes/:id/payer`, protégée, à la demande) : reprise d'un paiement en attente, retour de redirection
- [x] `RecuPage.jsx` (`/paiements/:id/recu`, protégée, à la demande) : reçu imprimable (`window.print()`)
- [x] Formats de commande : `montant_paye`, `reste_a_payer`, `statut_paiement` (détail et liste)
- [x] Textes dans les cinq langues (`paiements.*`), tests : `paiements.test.jsx`

Tâches : agent `site`, vérifiées par `site-testeur` (tests Vitest + Testing Library).
