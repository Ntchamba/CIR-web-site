# Module `equipe` (tableau de bord)

**Vague 0, Socle** · Besoins : BF-08, BF-17, BNF-01, BNF-06

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `EquipePage.jsx` : liste des membres, ajout, désactivation / réactivation
- `composants/FormulaireMembre.jsx` : ajout (nom, e-mail, téléphone, rôle, mot de passe provisoire)
- `composants/LigneMembre.jsx` : une ligne du tableau, retrait d’accès avec confirmation
- `useEquipe.js`, `api.js` (`/api/admin/comptes/equipe/`, `<id>/desactiver/`, `<id>/reactiver/`), `Equipe.module.css`

Tâches :

- [x] Liste des membres (rôle, statut, dernière connexion)
- [x] Ajout d’un membre, erreurs du serveur affichées sous les champs, en français
- [x] Désactivation (avec confirmation) et réactivation, visibles seulement pour un super-administrateur ;
      pas de bouton pour se retirer soi-même ; erreurs du serveur (ex. « Il doit rester au moins un
      super-administrateur actif. ») affichées en clair
- [x] Page et entrée de menu réservées au super-administrateur (l’API `/equipe/` l’est aussi)
- [ ] Tests Vitest + Testing Library (agent `tableau-de-bord-testeur`)
