# Modules à venir

Trois fonctions sont prévues mais pas encore développées. Leur place est déjà réservée dans le code :
le reste de l'application les appelle aux bons endroits, et les pages affichent « Bientôt disponible ».

## 1. Paiement par compte bancaire

- **Back-end** : `backend/apps/payments/` (parcours décrit dans `services.py`) ; l'API répond
  aujourd'hui `501` sur `/api/paiements/`.
- **Site** : `frontend/site/src/modules/paiement/` : bloc « Paiement » affiché dans le détail d'une
  commande quand le contrat est signé.
- **Dashboard** : `frontend/dashboard/src/modules/paiements/` : suivi des paiements reçus.
- Parcours prévu : paiement demandé après « Contrat signé », confirmation par la banque (webhook
  vérifié), possibilité d'enregistrer à la main un virement reçu. Aucune donnée bancaire n'est stockée.

## 2. Appels

- **Back-end** : `backend/apps/telephony/` ; `/api/appels/` répond aujourd'hui `501`.
- **Site** : `frontend/site/src/modules/appels/` : bouton « Appeler » qui ouvre le choix entre les
  options ci-dessous.
- **Dashboard** : `frontend/dashboard/src/modules/appels/`.
- Options prévues :
  - téléphonie locale, par les opérateurs Orange et MTN ;
  - téléphonie internationale, en Afrique d'abord, où Orange et MTN sont aussi les principaux
    opérateurs ;
  - demande de rappel (déjà possible par le formulaire de contact, objet « Être rappelé »).

## 3. E-mails (Gmail)

- **Back-end** : `backend/apps/notifications/services.py`. Tous les événements passent déjà par
  `notifier(...)` : nouvelle commande, nouvelle proposition, changement d'étape, message du
  formulaire de contact. Aujourd'hui, ils sont seulement écrits dans le journal du serveur.
- Pour brancher Gmail : renseigner `EMAIL_HOST_USER` et `EMAIL_HOST_PASSWORD` (mot de passe
  d'application Google) dans `.env`, passer `EMAIL_BACKEND` en SMTP et compléter `notifier`.

La **messagerie instantanée**, elle, est déjà développée (module `messaging`).
