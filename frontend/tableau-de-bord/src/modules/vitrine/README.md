# Module `vitrine` (tableau de bord)

**Vague 1, Vitrine** · Besoins : BF-02, BF-03, BF-04, BF-15 · API : `/api/admin/vitrine/`

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `VitrinePage.jsx` : titre, sous-navigation (compteur « en attente »), sous-routes `/vitrine/realisations` (par défaut), `/vitrine/demos`, `/vitrine/temoignages`
- `RealisationsPage.jsx`, `composants/TiroirRealisation.jsx` : photos avant (facultative) / après (obligatoire), produits utilisés (ids, chaîne JSON en multipart)
- `DemosPage.jsx`, `composants/TiroirDemo.jsx` : vidéo envoyée (50 Mo) ou lien YouTube / Vimeo, miniature, durée « 1:45 » ou « 1:02:30 » (règle du modèle), liens youtube, youtube-nocookie, youtu.be, vimeo, réalisation liée
- `TemoignagesPage.jsx`, `composants/CarteTemoignage.jsx` : modération
- `api.js`, `useVitrine.js` (`useRealisations`, `useDemos`, `useEnAttente`), `Vitrine.module.css`

Tâches :

- [x] Réalisations et démos : liste, création, modification, suppression avec confirmation, textes traduits, `langues_incompletes`
- [x] Témoignages : filtre par statut (en attente par défaut), publier, refuser avec motif facultatif, supprimer ; texte du client affiché tel quel avec sa langue ; compteur « en attente »
- [x] Erreurs 400 sous les champs, états de chargement et vides
- [x] Tests Vitest de base (`VitrinePage.test.jsx`)
- [ ] Suite de tests complète (agent `tableau-de-bord-testeur`)
