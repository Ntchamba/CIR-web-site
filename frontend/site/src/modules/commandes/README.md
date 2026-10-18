# Module `commandes` (site public)

**Vague 2, Commande** · Besoins : BF-10, BF-12, BF-13, BF-16 · Routes : `/commandes`, `/commandes/nouvelle`, `/commandes/:id` (protégées)

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `CommandesPage.jsx` : liste filtrée par étape (`?etat=`), réponse attendue signalée
- [x] `NouvelleCommandePage.jsx` : adresse incomplète (ou 403 `adresse_incomplete`) → message et lien `/compte`, sans formulaire ; lignes issues de la sélection ou de `?produit=<slug>&design=<id>` ; 429 traduit
- [x] `DetailCommande.jsx` + `composants/` : `EtapesCommande` (liste ordonnée, `aria-current`), `Negociation` (accepter, refuser, contre-proposer avec confirmation), `FormulaireProposition`, `Proposition`, `ActionsCommande` (modifier, annuler confirmé), `LignesCommande`, `Contrat` (impression), `BadgeEtape`
- [x] Les boutons suivent uniquement `actions_possibles` et `peut_repondre` du serveur ; aucun prix inventé ; `api.js`, `useCommandes.js`, `regles.js`, `Commandes.module.css`
- [x] Tests `CommandesPage`, `NouvelleCommandePage`, `DetailCommande`, `EtapesCommande`

API : `/api/commandes/` (liste, création, détail, `PATCH`, `annuler/`, `propositions/`, `propositions/<id>/accepter|refuser/`).
