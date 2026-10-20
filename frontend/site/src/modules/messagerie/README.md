# Module `messagerie` (site public)

**Vague 3, Échanges en direct** · Besoins : BF-11

Une conversation par client avec l'équipe, en direct (WebSocket `/ws/` fourni par `notifications/FondDirect.jsx`) et en HTTP
(reprise après coupure). Le texte des messages n'est jamais traduit ni interprété comme du HTML.

- [x] `api.js` : `conversation`, `messages` (`avant`, `apres`, `taille`), `envoyer`, `envoyerAvecFichiers`, `marquerLu`,
  `nonLus`, `recupererFichier` (pièces jointes privées, demandées avec le jeton)
- [x] `MessageriePage.jsx` (`/messages`, protégée) : titre de l'onglet avec le nombre de non lus, `BoutonAppel`
- [x] `composants/FilMessages.jsx` : groupé par jour, « Lu », « l'équipe écrit… », défilement vers le bas sauf si le lecteur
  est remonté, historique en remontant
- [x] `composants/Composeur.jsx` : Entrée envoie, Maj+Entrée = retour à la ligne (pas pendant une composition IME),
  compteur 2000, 3 pièces jointes au plus contrôlées avant l'envoi, choix de la commande (`?commande=` présélectionne)
- [x] `composants/PieceJointe.jsx` : aperçu des images et téléchargement par `fetch` + jeton
- [x] `useConversation.js` : envoi optimiste avec `cle_client` (WebSocket pour le texte seul, HTTP si le direct est coupé,
  pour les pièces jointes et après 10 s sans confirmation), « échec : réessayer », rattrapage par `apres`, marquage lu
  seulement si la page est visible et le bas du fil atteint
- [x] `useNonLus.js` : compteur du fond en direct
- [x] Tests : `messagerie.test.jsx` (API et WebSocket simulés)
