# Module `appels` (site public)

**Vague 3, Échanges en direct** · Besoins : BF-11

Le client appelle l'équipe en audio ou en vidéo (Jitsi JaaS). Seul un client lance un appel ; l'équipe ne peut pas appeler.

- [x] `api.js` : `disponibilite`, `lancer`, `lire`, `annuler`, `terminer` (`/api/appels/`)
- [x] `AppelContext.jsx` : appel en cours (fournisseur global dans `App.jsx`)
- [x] `composants/BoutonAppel.jsx` : masqué si `configure: false`, désactivé avec explication si l'équipe n'est pas en ligne
  (messagerie, détail d'une commande, page Contact) ; visiteur : lien vers la connexion
- [x] `composants/ChoixAudioVideo.jsx` : deux choix, avertissement micro et caméra, erreurs expliquées (409, 429, 503)
- [x] `composants/SalleAppel.jsx` (plein écran, dans le gabarit) : « ça sonne… » + annuler, « connecté », « personne n'a
  répondu » (écrire / demander un rappel), fin d'appel, micro ou caméra refusés ; lit l'appel toutes les 5 s tant qu'il
  sonne (l'expiration à 60 s est appliquée par le serveur à la lecture) ; libère l'API Jitsi au démontage
- [x] `jitsi.js` : charge `https://<domaine>/<app_id>/external_api.js` seulement au lancement d'un appel
- [x] Tests : `appels.test.jsx` (API et WebSocket simulés, Jitsi simulé)
