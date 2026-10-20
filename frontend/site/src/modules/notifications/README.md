# Module `notifications` (site public)

**Vague 3, Échanges en direct** · Besoins : BF-07, BF-13

- [x] `FondDirect.jsx` : fournisseur global (une connexion `/ws/` par session de client, `@partage/api/socket.js`), états,
  compteurs de messages et de notifications non lus, abonnement aux trames (`useEvenementsDirect`), repli HTTP toutes les
  15 s si le direct est coupé
- [x] `composants/BandeauDirect.jsx` : « connexion en direct interrompue »
- [x] `composants/CentreNotifications.jsx` : cloche avec pastille et menu des dernières notifications (en-tête)
- [x] `NotificationsPage.jsx` (`/notifications`, protégée) : liste paginée, filtre non lues, tout marquer comme lu, lien vers la cible
- [x] `composants/PreferenceNouveautes.jsx` : « Recevoir les nouveautés par e-mail » (consentement, désactivé par défaut),
  dans `NotificationsPage` et `ProfilPage`
- [x] `lien.js` : seuls les chemins du site sont suivis
- [x] Tests : `notifications.test.jsx`
