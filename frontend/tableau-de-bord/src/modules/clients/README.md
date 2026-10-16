# Module `clients` (tableau de bord)

**Vague 0, Socle** · Besoins : BF-08, BF-17, BNF-01, BNF-06

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `ClientsPage.jsx` : liste paginée, recherche, filtre par ville (critères gardés dans l’adresse : `?q=&ville=&page=`)
- `FicheClientPage.jsx` : fiche en lecture (`/clients/:id`)
- `composants/PastilleAdresse.jsx` : adresse complète ou non (condition pour commander)
- `useClients.js` (`useClients`, `useFicheClient`), `api.js` (`/api/admin/comptes/clients/`), `villes.js`, `Clients.module.css`

Tâches :

- [x] Liste des clients avec recherche (nom, e-mail, téléphone, ville, quartier) et filtre par ville
- [x] Pagination (24 par page, celle du back-end)
- [x] Fiche client en lecture (coordonnées, adresse, activité du compte)
- [ ] Commandes et échanges du client sur la fiche (vagues suivantes)
- [x] Tests Vitest + Testing Library (agent `tableau-de-bord-testeur`)
