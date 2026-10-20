# Module `notifications` (tableau de bord)

**Vague 3, Échanges en direct** · Besoins : BF-07, BF-13

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `NotificationsPage.jsx` : onglets « Mes notifications » (tous) ; « Modèles d'e-mails » et « Envois » (super-administrateur)
- `ModelesEmailsPage.jsx` : un événement et une langue à la fois, texte par défaut, variables autorisées, aperçu (cadre
  isolé `sandbox`), rétablir ; `modeles.js` (variables, lecture de la réponse)
- `composants/CentreNotifications.jsx` (cloche de l'en-tête), `composants/ElementNotification.jsx`,
  `composants/EnvoisEmails.jsx` (file d'envoi, erreurs, « Réessayer »), `composants/lien.js` (liens internes seulement)
- `api.js`, `useNotifications.js`, `Notifications.module.css`

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
