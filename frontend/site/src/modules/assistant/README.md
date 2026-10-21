# Module `assistant` (site public)

**Vague 5, Intelligence artificielle** · Besoins : O1, O4

Bulle flottante et fenêtre de dialogue avec l'assistant IA (`/api/assistant/`, contrat : `docs/taches/vague-5-contrat-api.md`).
Le texte de l'assistant est **toujours affiché en texte brut** ; seuls les `liens` du serveur (chemins internes) sont cliquables.
Pas de page dédiée : le module est monté par `layout/Gabarit.jsx` dans un chunk séparé, demandé quand le navigateur est au repos.

- [x] `api.js` : `disponibilite`, `envoyer`, `conversation`, `effacer`, `donnerAvis`
- [x] `BulleAssistant.jsx` : chargée à la demande, masquée si `configure` est faux (ou injoignable), désactivée avec explication si `ouvert` est faux, focus rendu à la fermeture
- [x] `composants/FenetreAssistant.jsx` : `role="dialog"` modal, piège du focus, Échap, plein écran sur téléphone, bandeau d'avertissement permanent, suggestions génériques, boutons « Écrire à l'équipe » / « Demander un devis », effacement confirmé
- [x] `composants/FilAssistant.jsx` : `role="log"` poli, « l'assistant écrit… », avis 👍/👎 (une fois), liens du serveur
- [x] `composants/Saisie.jsx` : Entrée envoie, Maj+Entrée retour à la ligne (pas pendant une composition IME), compteur 1000, `lang` du champ
- [x] `useAssistant.js` : un seul envoi à la fois, envoi optimiste, texte rendu au champ en cas d'échec, clé dans `localStorage` (`cir-site.assistant`, `try/catch`), historique rechargé à l'ouverture, clé inconnue (404) oubliée, conversation d'un compte oubliée à la déconnexion
- [x] `contexte.js` : `useContexteAssistant('produit'|'commande', référence)` appelé par `ProduitPage` et `DetailCommande`, sinon `{type: 'page'}`
- [x] `regles.js` : longueur, chemins internes sûrs, stockage de la clé, codes d'erreur → textes
- [x] Textes : `assistant.*` dans `src/i18n/{fr,en,zh,de,ja}.js`
- [x] Tests : `assistant.test.jsx` (API simulée)
