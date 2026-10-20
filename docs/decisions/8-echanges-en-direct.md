# Décision 8 : échanges en direct (vague 3)

Date : 20 octobre 2026. Statut : retenue. Détails : `docs/taches/vague-3-contrat-api.md`.

## Choix

- **Un seul WebSocket `/ws/`** par utilisateur connecté (messagerie, notifications, appels). Authentification par la
  **première trame** (jeton JWT) et non dans l'adresse, car les adresses finissent dans les journaux. Tout ce qui passe en
  direct existe aussi en HTTP (reprise après coupure).
- **Pièces jointes privées**, hors de `/media/`, servies par une vue qui vérifie les droits ; type contrôlé par la
  signature du fichier.
- **Jitsi (JaaS)** : jeton RS256 signé côté serveur, fonctions payantes désactivées (enregistrement, transcription),
  suivi des 25 utilisateurs actifs gratuits. Seul le client appelle ; expiration d'un appel calculée à partir de la base,
  jamais par un minuteur en mémoire.
- **Gmail (API, OAuth, jeton de rafraîchissement)** avec **file d'envoi en base** (`EnvoiEmail`) : aucun e-mail perdu si
  Gmail est indisponible ou non configuré, reprises espacées, plafond journalier, aucun doublon (clé unique, verrou de ligne).
  Un second service Railway (« worker ») lance `envoyer_emails --boucle`.
- **Notifications** par signaux Django : les modules métier n'importent jamais `notifications`. Une panne de
  notification ne fait jamais échouer l'action d'origine.
- **Nouveautés par e-mail** seulement avec le consentement du client (désactivé par défaut) et lien de désabonnement.
- **Dégradation douce** : service non configuré = fonction masquée ou en attente, jamais d'erreur 500.

## Conséquences

- Variables d'environnement ajoutées (voir le contrat) ; volume Railway nécessaire pour `DJANGO_PRIVATE_ROOT`.
- Redis recommandé en production pour la couche de canaux et la présence ; à défaut, un seul processus.
