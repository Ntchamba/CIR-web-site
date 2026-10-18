# Module `contact` (site public)

**Vague 2, Commande** · Besoins : BF-11, BF-13 · Routes : `/contact` (publique), `/mes-demandes` (protégée)

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `composants/SectionContact.jsx` : question ou rappel (créneau), champ piège `site_web` masqué, préremplissage depuis le compte, 429 traduit ; en bas de l'accueil et sur `/contact`
- [x] `ContactPage.jsx`, `MesDemandesPage.jsx` (demandes de contact et de rendu, réponses de l'équipe)
- [x] `api.js`, `regles.js`, `useContact.js`, `Contact.module.css`
- [x] Tests `contact.test.jsx`

API : `POST /api/contact/demandes/` (public), `GET /api/contact/demandes/miennes/`, `GET /api/devis/demandes-rendu/`.
