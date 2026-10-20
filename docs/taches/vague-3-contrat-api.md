# Vague 3 : contrat d'API (messagerie, appels, notifications, intégrations jaas et gmail)

Rédigé par le coordinateur le 20 octobre 2026. Les agents `backend`, `integrations`, `site` et `tableau-de-bord`
travaillent en parallèle à partir de ce contrat. Le back-end l'implémente, les front-ends le consomment (en tests, l'API
et le WebSocket sont simulés), l'agent `integrations` fournit deux petits clients pour les services externes.
Tout écart nécessaire est signalé dans le rapport de l'agent, jamais improvisé en silence.
Il complète `vague-1-contrat-api.md` et `vague-2-contrat-api.md` (règles communes : multilingue, médias, pagination,
isolation des clients, erreurs, quotas) ; tout ce qui n'est pas redit ici s'applique tel quel.

## Principes

1. **Services externes isolés** dans `backend/integrations/<service>/` : le reste du code ne parle qu'à ces fichiers.
   Les clés viennent **uniquement** des variables d'environnement (jamais dans le code, jamais dans un test, jamais
   dans un journal). **Aucun test n'appelle le réseau** : tout est simulé (`unittest.mock`).
2. **Service non configuré = l'application reste utilisable**, sans erreur 500 :
   - Jitsi non configuré : les boutons d'appel sont masqués côté site et tableau de bord ; l'API d'appel répond
     503 `{"detail": "…", "code": "appels_non_configures"}`.
   - Gmail non configuré : les e-mails restent en file d'attente (état `en_attente`), rien n'est perdu ; en
     développement ils s'affichent dans la console. Le tableau de bord montre le nombre d'e-mails en attente.
3. **Un seul WebSocket par utilisateur connecté**, `/ws/`, pour la messagerie, les notifications et les appels.
   Toute information donnée en direct existe aussi en HTTP (reprise après coupure, pages ouvertes sans WebSocket).
4. **Pièces jointes privées** : jamais dans `/media/` (public). Dossier privé `DJANGO_PRIVATE_ROOT`, servi par une vue
   qui vérifie les droits.
5. Le contenu écrit par les utilisateurs (messages, noms de fichiers) n'est jamais traduit ni interprété comme du HTML.
6. Aucune donnée de démonstration en base. Aucune clé réelle dans le dépôt : `.env.example` ne contient que des noms.

## Variables d'environnement (à ajouter à `backend/.env.example`)

`DJANGO_PRIVATE_ROOT` (dossier des pièces jointes privées), `SITE_URL` (adresse publique du site, pour les liens des
e-mails, ex. `https://revelation-sarl.com`), `ADMIN_URL_PUBLIQUE` (adresse du tableau de bord, liens des e-mails de
l'équipe), `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY` (clé privée RSA au format PEM ; les retours à la ligne
peuvent être écrits `\n`), `JAAS_WEBHOOK_SECRET`, `JAAS_LIMITE_GRATUITE` (défaut 25), `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_EXPEDITEUR` (adresse d'envoi), `GMAIL_LIMITE_JOUR` (défaut 400),
`NOTIFICATIONS_ENVOI_IMMEDIAT` (1 en développement et en tests : l'envoi se fait tout de suite au lieu d'attendre le
programme d'envoi).

## Intégration `jaas` (agent `integrations`)

Fichiers : `backend/integrations/jaas/{__init__.py, jetons.py, webhooks.py, erreurs.py}` et tests dans
`backend/integrations/jaas/tests/`. Dépendance à ajouter à `requirements.txt` : `PyJWT[crypto]`.

- `configure() -> bool` : vrai si `JAAS_APP_ID`, `JAAS_KEY_ID` et `JAAS_PRIVATE_KEY` sont présents et la clé est lisible.
- `parametres_client() -> {"domaine": "8x8.vc", "app_id": "<JAAS_APP_ID>"}` (utile au site pour charger le script
  `https://<domaine>/<app_id>/external_api.js`).
- `creer_jeton(*, salle, utilisateur_id, nom, email="", moderateur=False, duree_secondes=7200) -> str` : JWT signé
  RS256, en-tête `kid` = `JAAS_KEY_ID`, claims `aud: "jitsi"`, `iss: "chat"`, `sub: <app_id>`, `room: <salle>`,
  `nbf` (maintenant moins 10 s), `exp`, `context.user = {id, name, email, moderator: "true"|"false"}`,
  `context.features = {recording: "false", livestreaming: "false", transcription: "false", "outbound-call": "false"}`
  (aucune fonction payante : enregistrement et transcription coûtent de l'argent). Le nom de salle est contrôlé
  (`^[A-Za-z0-9_-]{8,64}$`). Lève `JaasNonConfigure` si `configure()` est faux.
- `webhooks.py` : `verifier(entetes, corps) -> bool` : compare **en temps constant** un secret partagé reçu dans
  l'en-tête `X-Webhook-Secret` (ou `Authorization: Bearer …`) à `JAAS_WEBHOOK_SECRET` ; faux si le secret n'est pas
  configuré. `analyser(corps) -> list[EvenementJaas]` (`type`, `salle`, `participant_id`, `horodatage`) pour les types
  `ROOM_CREATED`, `PARTICIPANT_JOINED`, `PARTICIPANT_LEFT`, `ROOM_DESTROYED` ; tout le reste est ignoré sans erreur ;
  corps invalide → liste vide.
- Tests : décodage du jeton avec la clé publique correspondante (clé de test générée dans le test, jamais stockée),
  claims, durée, rôle modérateur, salle invalide, clé absente ou illisible, secret de webhook absent/faux/correct,
  événements inconnus.

## Intégration `gmail` (agent `integrations`)

Fichiers : `backend/integrations/gmail/{__init__.py, client.py, erreurs.py, gabarits/base.html, gabarits/base.txt}` et
tests dans `backend/integrations/gmail/tests/`. Dépendance : `requests` (ajouter à `requirements.txt`).

- `configure() -> bool` : vrai si `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_EXPEDITEUR`
  sont présents.
- `MessageEmail` (dataclass) : `destinataire`, `sujet`, `texte`, `html=""`, `repondre_a=""`, `entetes: dict`
  (ex. `List-Unsubscribe`), `nom_expediteur="CIR"`.
- `envoyer(message) -> str` : renvoie l'identifiant du message Gmail. Étapes : jeton d'accès par l'échange du jeton de
  rafraîchissement (`https://oauth2.googleapis.com/token`, jeton gardé en mémoire jusqu'à 60 s avant son expiration),
  message MIME UTF-8 `multipart/alternative` (texte puis HTML), en-têtes propres (**refuser tout retour à la ligne dans
  le sujet, le destinataire ou un en-tête** : protection contre l'injection d'en-têtes), `Message-ID`, `Date`, puis
  `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` avec `{"raw": <base64url>}`, délai d'attente 15 s.
- Erreurs (`erreurs.py`) : `GmailNonConfigure` ; `GmailErreurTemporaire` (réseau, délai dépassé, 429, 5xx : on
  réessaiera) ; `GmailErreurDefinitive` (400, 401/403 de configuration, adresse refusée : inutile de réessayer).
  Jamais de clé ni de jeton dans les messages d'erreur ni dans les journaux.
- `gabarits/base.html` et `base.txt` : mise en page commune des e-mails (couleurs CIR : encre `#0E2A38`, bleu `#1177A8`,
  corail `#FF6D4C`, fond `#F3F7F9` ; styles en ligne, largeur 600 px, lisible sans images), variables
  `titre`, `corps_html`/`corps_texte`, `lien`, `libelle_lien`, `pied`, `lien_desabonnement`. Échappement automatique
  de Django activé pour tout ce qui vient d'un utilisateur.
- Tests (réseau simulé) : MIME correct (accents, caractères chinois et japonais), injection d'en-tête refusée,
  échange de jeton mis en cache, expiration, 429 et 5xx → temporaire, 400 → définitif, non configuré, aucune fuite de
  secret dans les messages d'erreur.

## Module `messagerie` (BF-11)

### Modèles

- `Conversation` : `client` (FK unique, PROTECT), `cree_le`, `dernier_message_le` (null, indexé).
  **Une conversation par client** ; elle est créée à la demande (client ou équipe).
- `Message` : `conversation`, `auteur` (FK utilisateur), `auteur_role` (`client`|`equipe`), `texte` (0 à 2000 caractères ;
  vide seulement s'il y a une pièce jointe), `commande` (FK null : « à propos de CIR-2026-0001 », doit appartenir au
  client de la conversation), `cle_client` (texte ≤ 64, facultatif : identifiant choisi par le navigateur pour éviter
  un doublon si l'envoi est rejoué ; unique avec `conversation` quand il est renseigné), `cree_le`, `lu_le` (null :
  date à laquelle **l'autre partie** l'a lu).
- `PieceJointe` : `message` (null tant qu'elle n'est pas rattachée), `proprietaire` (FK utilisateur), `fichier`
  (stockage privé), `nom_original` (≤ 150, nettoyé), `type` (`image`|`document`), `taille`, `cree_le`.

### Pièces jointes (`messagerie/pieces_jointes.py`)

3 par message au plus, 10 Mo chacune. Types acceptés, **contrôlés par la signature du fichier** (pas par l'extension ni
le type envoyé) : images JPEG, PNG, WebP, GIF (converties en WebP, 1600 px au plus, via `noyau/images.py`) et PDF. Tout
le reste (HTML, SVG, exécutables, archives, scripts, fichier vide) : 400 sur `fichiers`. Le nom envoyé n'est jamais repris
pour le stockage (nom aléatoire) ; `nom_original` est nettoyé (pas de chemin, pas de caractère de contrôle). Une pièce jointe
non rattachée depuis plus de 24 h est supprimée par la commande `purger_pieces_jointes`. Téléchargement uniquement par la
vue `GET pieces-jointes/<id>/` (droits vérifiés, `Content-Disposition` avec nom nettoyé, `X-Content-Type-Options: nosniff`,
pas de mise en cache publique).

### API client `/api/messagerie/` (`EstClient`)

- `GET conversation/` → `{id, non_lus, dernier_message: <Message>|null}` (crée la conversation si besoin).
- `GET messages/` `?avant=<id>&apres=<id>&taille=30` (30 par défaut, 100 au plus) → `{results: [<Message>], a_plus: bool}`,
  du plus ancien au plus récent ; `avant` pour charger l'historique, `apres` pour rattraper les messages manqués.
- `POST messages/` JSON `{texte?, commande?, cle_client?, pieces_jointes?: [<id>]}` ou multipart `{texte?, commande?,
  cle_client?, fichiers?: [fichier ≤ 3]}` → 201 `<Message>` ; diffusé en direct. Message vide sans pièce jointe : 400.
  Quota : 30 messages par minute et par compte (429 `code: "trop_de_messages"`).
- `POST pieces-jointes/` multipart `{fichier}` → 201 `{id, nom_original, type, taille, url}` (rattachée ensuite par
  `pieces_jointes` ; uniquement ses propres pièces non rattachées).
- `GET pieces-jointes/<id>/` → le fichier (client de la conversation ou équipe seulement ; 404 sinon).
- `POST lu/` `{jusqu_a: <id message>}` → `{non_lus}` ; marque lus les messages de l'équipe jusqu'à cet identifiant.
- `GET non-lus/` → `{non_lus}`.

`<Message>` : `{id, conversation, auteur_role, auteur_nom, texte, commande: {id, reference}|null,
pieces_jointes: [{id, nom_original, type, taille, url}], cree_le, lu_le, cle_client}`.

### API équipe `/api/admin/messagerie/` (`EstEquipe`)

- `GET conversations/` paginé `?non_lus=1&search=` (nom, e-mail, téléphone du client) → `[{id, client: {id, nom_complet,
  email, telephone, langue}, dernier_message: {texte (aperçu de 120 caractères), auteur_role, cree_le}|null, non_lus,
  dernier_message_le}]`, la plus récente activité d'abord.
- `POST conversations/` `{client: <id>}` → conversation (créée ou existante, 200 ou 201) ; le client doit être un compte client.
- `GET conversations/<id>/messages/` et `POST conversations/<id>/messages/` : comme côté client (`avant`, `apres`,
  `taille`, JSON ou multipart). `POST conversations/<id>/lu/` `{jusqu_a}` → `{non_lus}` (messages du client).
- `GET resume/` → `{non_lus_total, conversations_non_lues}` (pastille du menu).
- Pièces jointes : même vue de téléchargement ; l'équipe peut aussi `POST pieces-jointes/` pour ses propres envois.

## WebSocket `/ws/` (`messagerie/consumers.py`, `messagerie/routing.py`, `config/routing.py`, `config/asgi.py`)

Connexion : `ws(s)://<hôte>/ws/` (Channels, `AllowedHostsOriginValidator`). **L'authentification se fait par la
première trame**, jamais dans l'adresse (les adresses finissent dans les journaux) : le client envoie
`{"type": "authentifier", "jeton": "<jeton d'accès JWT>"}` dans les **5 secondes**, sinon le serveur ferme (code 4401). Jeton
invalide, expiré ou compte inactif : trame d'erreur puis fermeture 4401. Trames de 16 Ko au plus (sinon fermeture 4413).

Client → serveur (toutes en JSON) :
- `{"type": "authentifier", "jeton": "…"}` (obligatoire en premier).
- `{"type": "ping"}` toutes les 25 secondes → réponse `{"type": "pong"}` (maintient la présence en ligne, TTL 90 s).
- `{"type": "envoyer", "texte": "…", "commande"?: <id>, "cle_client"?: "…", "conversation"?: <id>}` : texte seul
  (client : sa conversation ; équipe : `conversation` obligatoire). Mêmes règles et mêmes quotas que `POST messages/`.
- `{"type": "lu", "jusqu_a": <id>, "conversation"?: <id>}`.
- `{"type": "ecrit", "conversation"?: <id>}` : « est en train d'écrire » (au plus un toutes les 3 s, sinon ignoré).

Serveur → client :
- `{"type": "pret", "utilisateur": {id, role}, "non_lus": <n>, "notifications_non_lues": <n>}` après authentification.
- `{"type": "message", "message": <Message>}` : le client reçoit les messages de sa conversation (les siens aussi, pour
  confirmer l'envoi : repérés par `cle_client`) ; **toute l'équipe** reçoit les messages de tous les clients.
- `{"type": "lu", "conversation": <id>, "par": "client"|"equipe", "jusqu_a": <id>}`.
- `{"type": "ecrit", "conversation": <id>, "par": "client"|"equipe"}`.
- `{"type": "non_lus", "messagerie": <n>, "notifications": <n>}` à chaque changement des compteurs de l'utilisateur.
- `{"type": "notification", "notification": <Notification>}`.
- Appels (voir plus bas) : `{"type": "appel_entrant", "appel": <Appel>}` (équipe), `{"type": "appel_mis_a_jour",
  "appel": <Appel>}` (client et équipe concernés).
- `{"type": "erreur", "code": "<code>", "detail": "<texte traduit>"}` avec les codes `non_authentifie`, `message_vide`,
  `trop_long`, `trop_de_messages`, `conversation_inconnue`, `interdit`, `format_invalide`. Une erreur n'ferme pas la
  connexion (sauf authentification). Pour une trame `envoyer` refusée, l'erreur reprend `cle_client` si elle a été fournie
  (le front repère ainsi le message optimiste en échec).

Groupes Channels : chaque connexion rejoint `utilisateur_<id>` ; l'équipe rejoint aussi `equipe`. Les modules publient
uniquement par `apps/noyau/direct.py` : `publier_utilisateur(utilisateur_id, type, donnees)` et `publier_equipe(type,
donnees)` (appelables depuis du code synchrone, sans bloquer ; une panne du canal ne fait jamais échouer l'action
d'origine : elle est journalisée). Présence : `apps/noyau/presence.py` (`marquer_en_ligne(utilisateur)`,
`equipe_en_ligne() -> int`, par le cache avec TTL 90 s ; Redis en production). Plusieurs onglets ouverts par la même
personne sont normaux.

## Module `appels` (BF-11)

Modèle `Appel` : `reference` (« APP-2026-0001 »), `client` (FK), `type` (`audio`|`video`), `commande` (FK null, une
commande du client), `salle` (aléatoire, `cir-` + 24 caractères hexadécimaux, jamais devinable, jamais réutilisée),
`etat` (`sonne`, `en_cours`, `termine`, `manque`, `refuse`, `annule`), `repondu_par` (FK équipe, null), `cree_le`,
`demarre_le`, `termine_le`. Fichier propre : `salles.py` (création de salle, sonnerie, délais). Utilise
`integrations/jaas/`.

Règles : seul un **client** lance un appel ; un seul appel actif (`sonne` ou `en_cours`) par client (409 `code:
"appel_deja_en_cours"`) ; **l'équipe ne peut pas appeler un client** dans cette version ; si personne de l'équipe
n'est en ligne (`equipe_en_ligne() == 0`) la demande est refusée avec 409 `code: "equipe_indisponible"` (le client est
alors invité à écrire un message ou demander un rappel) ; sans réponse après **60 secondes** l'appel passe à `manque`
(tâche vérifiée à chaque lecture de l'appel et par la commande `expirer_appels`, jamais par un minuteur en mémoire) et
une notification « appel manqué » est envoyée à l'équipe ; un appel `sonne` annulé par le client passe à `annule` ; la
première personne de l'équipe qui répond gagne (verrou en base : une seconde réponse → 409 `code: "appel_pris"`) ;
`refuse` quand l'équipe décline. L'état `en_cours` peut aussi être posé par un événement `PARTICIPANT_JOINED` du
webhook, `termine` par `ROOM_DESTROYED` ; jamais de dépendance au webhook pour le bon fonctionnement.

`<Appel>` : `{id, reference, type, etat, client: {id, nom_complet, telephone}, commande: {id, reference}|null,
cree_le, demarre_le, termine_le, repondu_par: {id, nom_complet}|null, duree_secondes|null}` (le client ne voit pas
`telephone` d'un autre : c'est le sien).

API client `/api/appels/` (`EstClient`) :
- `GET disponibilite/` → `{configure: bool, equipe_en_ligne: bool}` (jamais le nombre exact).
- `POST /` `{type: "audio"|"video", commande?: <id>}` → 201 `{appel: <Appel>, jitsi: {domaine, app_id, salle, jeton}}` ;
  le jeton est celui d'un **participant** (non modérateur). Erreurs : 503 `appels_non_configures`, 409
  `appel_deja_en_cours` ou `equipe_indisponible`, 429 (5 appels par heure et par compte). Diffuse `appel_entrant` à
  l'équipe.
- `GET <id>/` → `{appel: <Appel>}` (état actuel ; applique l'expiration à 60 s) ; seulement ses propres appels.
- `POST <id>/annuler/` (état `sonne`) et `POST <id>/terminer/` (état `en_cours`) → `{appel}`.

API équipe `/api/admin/appels/` (`EstEquipe`) :
- `GET /` paginé `?etat=&search=` : historique (les appels manqués en tête avec un champ `rappel: {telephone, lien_messagerie}` ; `lien_messagerie` = chemin du tableau de bord `/messagerie?client=<id du client>`).
- `GET en-attente/` → `[<Appel>]` appels qui sonnent (pour l'ouverture de page et la reprise après coupure).
- `POST <id>/repondre/` → `{appel, jitsi: {domaine, app_id, salle, jeton}}` avec un jeton **modérateur** ; passe l'appel
  à `en_cours`, prévient le client (`appel_mis_a_jour`) et les autres membres (`appel_mis_a_jour`, pour arrêter leur
  sonnerie).
- `POST <id>/refuser/`, `POST <id>/terminer/`.
- `GET usage/` → `{mois: "2026-10", utilisateurs_actifs, limite_gratuite, configure: bool (Jitsi configuré), depasse: bool, proche: bool}`
  (`proche` à partir de 80 % de la limite gratuite) : nombre de **clients distincts** ayant eu un appel `en_cours` ou
  `termine` ce mois-ci (aide à rester dans l'offre gratuite de 25 utilisateurs actifs).
- `GET resume/` → `{en_attente, manques_non_vus}` (pastille du menu ; un manqué est « vu » quand l'équipe ouvre la liste).

Webhook : `POST /api/appels/webhooks/jaas/` (sans authentification JWT, protégé par `integrations.jaas.webhooks.verifier` ;
503 si le secret n'est pas configuré, 403 s'il est faux, 204 sinon). Les événements inconnus sont ignorés.

## Module `notifications` (BF-07, BF-13)

### Principe

`notifications/evenements.py` (« qui reçoit quoi ») fait le lien entre les événements des autres modules et les
destinataires. Les autres modules **n'importent jamais** `notifications` : ils émettent des signaux Django
(`apps/<module>/signals.py`) auxquels `notifications` s'abonne dans `apps.py`. Une panne de notification ne fait jamais
échouer l'action d'origine (erreur journalisée). Signaux à ajouter dans les modules existants (changements minimes dans
leurs services, avec tests) :

| Signal | Module | Émis quand |
|---|---|---|
| `commande_creee(commande)` | commandes | création d'une commande |
| `etape_changee(commande, de, vers, auteur)` | commandes | changement d'étape |
| `proposition_creee(proposition)` | commandes | nouvelle proposition (client ou équipe, devis envoyé compris) |
| `proposition_acceptee`, `proposition_refusee` | commandes | (existants, vague 2) |
| `devis_envoye(devis)` | devis | envoi d'un devis |
| `demande_rendu_creee(demande)`, `demande_rendu_repondue(demande)` | devis | dépôt ; réponse ou changement d'état par l'équipe |
| `demande_contact_creee(demande)`, `demande_contact_repondue(demande)` | contact | dépôt ; réponse ou état `traitee` |
| `actualite_publiee(actualite)` | actualites | la nouveauté devient visible (voir ci-dessous) |
| `message_cree(message)` | messagerie | nouveau message |
| `appel_manque(appel)` | appels | passage à `manque` |

Nouveautés (BF-07) : ajouter `Actualite.notifiee_le` (null). La commande `notifier_actualites` (lancée par la boucle
d'envoi) repère les actualités publiées et visibles dont `notifiee_le` est vide, émet `actualite_publiee` **une seule
fois** puis renseigne `notifiee_le`. Les nouveautés partent par e-mail **uniquement** aux clients qui ont activé
`recevoir_nouveautes` (désactivé par défaut : consentement), avec lien de désabonnement ; elles apparaissent dans le
centre de notifications de tous les clients.

### Événements, destinataires, canaux

Langue de chaque e-mail : `Utilisateur.langue` du destinataire (le sujet, le texte et le gabarit passent par
`translation.override`). Texte d'une notification dans l'application : produit **à la lecture** dans la langue de la
requête (`Accept-Language`) à partir de `type` et `donnees` (aucun texte figé en base).

| Type | Destinataire | Application | E-mail |
|---|---|---|---|
| `commande_creee` | le client | oui | oui |
| `commande_nouvelle` | toute l'équipe | oui | oui (si `email_equipe`) |
| `proposition_recue` (de l'équipe) | le client | oui | oui |
| `proposition_client` (contre-proposition, acceptation, refus) | l'équipe | oui | oui (si `email_equipe`) |
| `contrat_signe` | le client et l'équipe | oui | oui |
| `etape_changee` (travaux, terminée, annulée) | le client | oui | oui |
| `devis_envoye` | le client | oui | oui |
| `demande_rendu_nouvelle` | l'équipe | oui | oui (si `email_equipe`) |
| `demande_rendu_repondue` | le client | oui | oui |
| `contact_nouveau` | l'équipe | oui | oui (si `email_equipe`) |
| `contact_repondu` | le client connecté | oui | oui |
| `message_nouveau` | l'autre partie | oui | **différé** : voir ci-dessous |
| `appel_manque` | l'équipe | oui | oui (si `email_equipe`) |
| `nouveaute` | tous les clients | oui | seulement si `recevoir_nouveautes` |

E-mail d'un message (`message_nouveau`) : envoyé seulement si le destinataire n'est pas en ligne et que le message n'est
toujours pas lu **10 minutes** après son envoi, au plus **un e-mail par conversation et par heure** (la boucle d'envoi
fait cette vérification). Un message lu entre-temps n'envoie rien. Les visiteurs sans compte qui écrivent par le
formulaire de contact ne reçoivent pas d'e-mail (aucun tracé de leur côté) sauf une réponse manuelle hors application.

### File d'envoi (e-mails)

Modèle `EnvoiEmail` : `destinataire_email`, `utilisateur` (FK null), `evenement`, `cle_unique` (unique : empêche d'envoyer
deux fois le même e-mail, ex. `commande_creee:12:7`), `sujet`, `corps_texte`, `corps_html`, `entetes` (JSON), `etat`
(`en_attente`, `envoye`, `echec`, `annule`), `tentatives`, `prochaine_tentative`, `derniere_erreur`, `message_id`,
`cree_le`, `envoye_le`. Règles (`taches.py`) :

- La notification crée la ligne dans la même transaction que l'action d'origine. Avec `NOTIFICATIONS_ENVOI_IMMEDIAT=1`,
  l'envoi est tenté juste après la validation de la transaction (`transaction.on_commit`) ; sinon par la commande
  `python manage.py envoyer_emails` (une passe) ou `--boucle` (toutes les 20 secondes ; c'est le démarrage d'un second
  service Railway, « worker »). La boucle fait aussi `notifier_actualites`, `expirer_appels` et `purger_pieces_jointes`.
- Reprises : après une erreur temporaire, 1 min, 5 min, 30 min, 3 h, puis `echec` (5 tentatives). Erreur définitive :
  `echec` tout de suite. **Plafond journalier** `GMAIL_LIMITE_JOUR` (défaut 400) : au-delà, les envois restants
  attendent le lendemain. Verrou de ligne (`select_for_update(skip_locked=True)`) pour que deux processus n'envoient
  jamais le même e-mail.
- Gmail non configuré : les lignes restent `en_attente`, sans compter de tentative. En développement
  (`DEBUG` vrai) l'e-mail est écrit dans la console à la place.
- Un destinataire sans e-mail valide, ou dont le compte est désactivé : `annule`.

### Modèles de messages (BF-07)

`ModeleEmail` : `evenement` (l'un des types ci-dessus qui envoient un e-mail), `langue` (`fr|en|zh|de|ja`), `sujet`
(≤ 150), `introduction` (≤ 1000) ; unique sur (`evenement`, `langue`). Les textes **par défaut** viennent des traductions
(`_()` dans `evenements.py`, `.po` des 4 langues) ; un modèle enregistré par le super-administrateur les remplace (sujet et
introduction seulement ; le reste de l'e-mail, y compris les montants et liens, est fixé par le code). Variables
autorisées dans `{…}` : `{nom}`, `{reference}`, `{montant}`, `{etape}` ; toute autre variable → 400. Aperçu par
`POST modeles/apercu/`. Contenu échappé en HTML.

### Notifications dans l'application

`<Notification>` : `{id, type, titre, texte, lien, lue, cree_le}` ; `lien` est un chemin du site (client : `/commandes/12`,
`/messages`, `/actualites/<slug>`, `/mes-demandes`…) ou du tableau de bord (équipe : `/commandes/12`, `/messagerie`,
`/contact`, `/devis`, `/appels`). Elles sont aussi poussées en direct (`{"type": "notification"}`) et leurs compteurs
suivent (`non_lus`).

API client `/api/notifications/` (`EstClient`) :
- `GET /` paginé `?lue=0|1` ; `GET non-lues/` → `{count}` ; `POST <id>/lue/` ; `POST lues/` (tout marquer comme lu, renvoie `{count: 0}`).
- `GET preferences/` et `PATCH preferences/` → `{recevoir_nouveautes: bool}` (champ `Utilisateur.recevoir_nouveautes`,
  migration `comptes`, défaut faux). `GET /api/comptes/moi/` renvoie aussi `recevoir_nouveautes`.
- `GET desabonnement/?jeton=<jeton signé>` (public, sans compte) : désactive `recevoir_nouveautes` pour le compte du jeton
  (signature Django `signing`, sans expiration), répond une page HTML très simple traduite (langue de la requête), jamais
  d'erreur détaillée pour un jeton faux (404 générique). Compatible `List-Unsubscribe` (la requête `POST` à la même
  adresse fait pareil).

API équipe `/api/admin/notifications/` (`EstEquipe`) :
- Les mêmes routes pour **ses propres** notifications (`GET /`, `non-lues/`, `<id>/lue/`, `lues/`).
- `GET/PATCH preferences/` → `{email_equipe: bool}` (champ `Utilisateur.email_equipe`, défaut vrai).
- Super-administrateur seulement (`EstSuperAdmin`) : `GET modeles/` (liste `[{evenement, libelle, variables, langues: [{langue, defaut: {sujet, introduction}, modele: {sujet, introduction}|null}]}]`, les 5 langues dans l'ordre fr, en, zh, de, ja), `PUT modeles/<evenement>/<langue>/` `{sujet, introduction}`, `DELETE
  modeles/<evenement>/<langue>/` (retour au texte par défaut), `POST modeles/apercu/` `{evenement, langue, sujet?,
  introduction?}` → `{sujet, corps_html, corps_texte}` avec des valeurs d'exemple (jamais de vrai client) ;
  `GET envois/` paginé `?etat=` avec `{id, destinataire_email (masqué : j***@exemple.cm), evenement, etat, tentatives,
  derniere_erreur, cree_le, envoye_le}` ; `GET envois/resume/` → `{en_attente, envoye, echec, annule, gmail_configure}` ;
  `POST envois/<id>/reessayer/` (état `echec` seulement).

## Partage (frontend/partage), fourni par le coordinateur

`frontend/partage/api/socket.js` est **déjà écrit** (avec ses tests) : `creerConnexionDirect({ api, url?, surEvenement,
surEtat })` → `{ envoyer(trame), fermer(), etat() }`. Il se connecte à `<VITE_API_URL en ws(s)>/ws/`, envoie la trame
d'authentification, relance après une coupure (délais 1 s, 2 s, 4 s… jusqu'à 30 s, jeton renouvelé avant chaque
reconnexion), envoie `ping` toutes les 25 s, met en file au plus 20 trames pendant une coupure, et appelle
`surEvenement(trame)` pour chaque trame du serveur et `surEtat('connexion'|'connecte'|'coupe')`. Les agents l'utilisent
tel quel (ne pas le modifier ; signaler un besoin dans le rapport).

## Site public (agent `site`)

Routes (chargées à la demande, protégées sauf mention) : `/messages` (`MessageriePage`), `/notifications`
(`NotificationsPage`, avec les préférences). Le reste passe par des composants globaux dans le gabarit :
`FondDirect` (fournisseur : une connexion `/ws/` pour toute l'application quand le client est connecté, états, compteurs,
événements ; coupe à la déconnexion ; si l'API ne répond pas, retombe sur une lecture HTTP toutes les 15 s avec un
bandeau « connexion en direct interrompue »), `CentreNotifications` (cloche avec pastille et menu des dernières
notifications), icône Messages avec pastille dans l'en-tête, **onglet Messages** dans la barre mobile à la place de rien
d'existant (Accueil, Catalogue, Réalisations, Commandes, Messages, Compte : six onglets si la place le permet, sinon
Compte passe dans l'en-tête), `SalleAppel` (plein écran), `BoutonAppel`.

- Messagerie : `FilMessages` (du plus ancien au plus récent, groupés par jour, « Lu » sous les messages lus, indicateur
  « l'équipe écrit… », défilement vers le bas à l'arrivée d'un message sauf si le lecteur est remonté), chargement de
  l'historique en remontant (`avant`), saisie avec Entrée pour envoyer et Maj+Entrée pour un retour à la ligne,
  compteur 2000, pièces jointes (3 au plus, aperçu avant l'envoi pour les images, retrait, refus clair des types et
  tailles interdits **avant** l'envoi), liste des commandes du client pour joindre « à propos de… », envoi par le
  WebSocket pour le texte seul et par HTTP pour les pièces jointes, **envoi optimiste** avec `cle_client` (le message
  s'affiche tout de suite, passe à « envoyé » à la confirmation, ou « échec : réessayer »), rattrapage par `apres` à la
  reconnexion, marquage « lu » seulement quand la page est visible (`document.visibilityState`) et que le bas du fil
  est atteint, titre de l'onglet avec le nombre de non lus.
- Appels : `BoutonAppel` (sur la messagerie, le détail d'une commande, la page Contact ; **masqué** si
  `GET disponibilite/` renvoie `configure: false`, désactivé avec explication si l'équipe n'est pas en ligne),
  `ChoixAudioVideo` (deux choix clairs, avertissement micro et caméra), `SalleAppel` (charge le script
  `https://<domaine>/<app_id>/external_api.js` **seulement au lancement d'un appel**, ouvre l'appel avec `jwt`, nom du
  client, interface minimale, états « ça sonne… » avec bouton annuler, « connecté », « personne n'a répondu » avec
  boutons « Écrire un message » et « Demander un rappel » (lien `/contact`), fin d'appel, erreurs de micro/caméra
  refusés expliquées). Libération propre de l'API Jitsi au démontage.
- Notifications : liste paginée, « tout marquer comme lu », lien vers la cible, préférence « Recevoir les nouveautés
  par e-mail » (consentement, désactivé par défaut) dans `NotificationsPage` et dans `ProfilPage`.
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js`. Aucun texte en dur. Texte des messages jamais traduit.

## Tableau de bord (agent `tableau-de-bord`)

Menu : `messagerie`, `appels`, `notifications` passent de « À venir » à « Pilotage », avec pastilles (messages non lus,
appels qui sonnent ou manqués non vus, notifications non lues), mises à jour **en direct** par le WebSocket (en plus du
rechargement à la navigation de `usePastilles`).

- Global (dans `Coque`) : `FondDirect` (une connexion `/ws/` pour toute l'application), `SonnerieAppel` (bannière
  « Appel entrant de … » avec Répondre et Refuser, sonnerie répétée tant que l'appel sonne **seulement si le navigateur
  l'autorise** : un bouton « Activer la sonnerie » demande l'autorisation par un geste, son court généré par
  `AudioContext` ou fichier léger ; arrêt dès qu'un autre membre répond ; titre de l'onglet clignotant), `SalleAppel`
  (modérateur), et centre de notifications dans l'en-tête.
- `/messagerie` (`MessageriePage`) : liste des conversations à gauche (recherche, filtre « non lus », pastille par
  conversation, aperçu, heure) et fil à droite (mêmes comportements que le site : optimiste, lu, « écrit… », pièces
  jointes, historique, rattrapage, marquage lu seulement si visible) ; sur téléphone, liste puis fil en plein écran avec
  retour. Contexte client dans le fil : nom, téléphone et e-mail cliquables, lien vers ses commandes (`/clients/:id`,
  `/commandes?client=`), bouton « Nouvelle conversation » (choix d'un client).
- `/appels` (`AppelsPage`, nommé `AppelsEntrantsPage` dans le README) : historique filtrable (état, recherche), appels
  manqués en tête avec « Rappeler » (`tel:`) et « Écrire » (ouvre la conversation), jauge d'utilisation JaaS
  (`usage/` : « 18 sur 25 utilisateurs actifs ce mois-ci », alerte à 80 % et au-delà), message clair si Jitsi n'est pas configuré.
- `/notifications` (`NotificationsPage`) : onglets « Mes notifications » (liste, tout marquer comme lu, préférence
  `email_equipe`) ; pour le super-administrateur « Modèles d'e-mails » (`ModelesEmailsPage` : un événement et une langue
  à la fois, texte par défaut visible, sujet et introduction modifiables avec les variables autorisées indiquées,
  aperçu, rétablir par défaut) et « Envois » (état de la file : en attente, envoyés, échecs avec l'erreur, bouton
  Réessayer, avertissement si Gmail n'est pas configuré).
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js`. Aucun texte en dur.

## Sécurité à vérifier par les testeurs

Authentification du WebSocket (première trame, délai, jeton expiré, compte désactivé, ordre des trames), isolation (un
client ne reçoit jamais le message d'un autre, ni une pièce jointe d'un autre, ni un appel d'un autre), pièces jointes
(signature, tailles, noms, téléchargement protégé, absence dans `/media/`), injection d'en-têtes d'e-mail, échappement
HTML des e-mails et des messages, jeton de désabonnement, secret du webhook en temps constant, aucune clé dans le code ni
dans les journaux, quotas (messages, appels), expiration des appels par l'état en base (pas de minuteur en mémoire),
verrou de la réponse à un appel (deux membres de l'équipe en même temps), file d'envoi sans doublon (deux processus),
plafond journalier d'e-mails.
