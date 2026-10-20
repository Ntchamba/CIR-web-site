# Module `appels` (tableau de bord)

**Vague 3, Échanges en direct** · Besoins : BF-11

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `AppelsEntrantsPage.jsx` : historique filtrable, manqués en tête (« Rappeler », « Écrire »), jauge d'usage, sonnerie
- `SonnerieAppel.jsx` : bannière d'appel entrant (global, dans la coque), sonnerie, titre clignotant
- `SalleAppel.jsx` : salle plein écran (modérateur) ; `jitsi.js` charge le script JaaS au moment de répondre seulement
- `sonnerie.js` : son généré par `AudioContext`, activé par un geste de la personne
- `composants/JaugeUsage.jsx`, `api.js`, `useAppels.js`, `Appels.module.css`

L'équipe ne lance jamais d'appel : elle répond aux appels des clients.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
