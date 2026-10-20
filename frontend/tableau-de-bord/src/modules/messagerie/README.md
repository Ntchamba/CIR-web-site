# Module `messagerie` (tableau de bord)

**Vague 3, Échanges en direct** · Besoins : BF-11

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `MessageriePage.jsx` : liste à gauche, fil à droite (téléphone : l'un puis l'autre, avec retour)
- `composants/ListeConversations.jsx`, `composants/FilMessages.jsx`, `composants/SaisieMessage.jsx`,
  `composants/ContexteClient.jsx`, `composants/NouvelleConversation.jsx`, `composants/PieceJointe.jsx`
- `api.js` (API `/api/admin/messagerie/`), `useMessagerie.js` (liste, sélection `?conversation=`, ouverture `?client=`),
  `useFil.js` (fil d'une conversation, envoi optimiste avec `cle_client`, rattrapage)

Le texte des messages n'est jamais traduit ni interprété comme du HTML. Les pièces jointes sont privées : elles sont lues
avec le jeton de la session (`lirePieceJointe`), jamais par un lien public.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
