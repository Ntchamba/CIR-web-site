# Module `vitrine` (site public)

**Vague 1, Vitrine** · Besoins : BF-02, BF-03, BF-04, BF-15 · Route : `/realisations`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

- [x] `VitrinePage.jsx` : sommaire (ancres `#chantiers`, `#demos`, `#temoignages`) et trois sections
- [x] `composants/Realisations.jsx` + `CarteRealisation.jsx` : filtre par type de chantier (`?type=`), « Voir plus »
- [x] `composants/AvantApres.jsx` : curseur `<input type="range">` (clavier, doigt, valeur annoncée)
- [x] `composants/Demos.jsx` : la vidéo ou le lecteur intégré (YouTube sans cookie, Vimeo) ne se charge
  qu'au clic ; adresse d'intégration contrôlée (`regles.js`)
- [x] `composants/Temoignages.jsx` : textes dans leur langue d'origine (attribut `lang`), note annoncée
- [x] `composants/FormulaireTemoignage.jsx` : client connecté (sinon lien `/connexion?suite=…`), contrôle avant
  envoi (20 à 800 caractères, note 1 à 5), message « en attente de validation », liste « Vos témoignages » et statut
- [x] `api.js`, `useVitrine.js`, `regles.js`, `Vitrine.module.css`
- [x] Tests `VitrinePage.test.jsx` (agent `site`, à compléter par `site-testeur`)

API : `GET /api/vitrine/realisations/?type=&page=`, `GET /api/vitrine/demos/`, `GET /api/vitrine/temoignages/`,
`POST /api/vitrine/temoignages/` `{texte, note, ville?, type_chantier?}` (connecté), `GET /api/vitrine/temoignages/miens/`.
