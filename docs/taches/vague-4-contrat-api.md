# Vague 4 : contrat d'API (paiements, statistiques, intégration CamPay)

Rédigé par le coordinateur le 20 octobre 2026. Les agents `backend`, `integrations`, `site` et `tableau-de-bord`
travaillent en parallèle à partir de ce contrat. Le back-end l'implémente, les front-ends le consomment (en tests, l'API
et le WebSocket sont simulés), l'agent `integrations` fournit le client CamPay. Tout écart nécessaire est signalé dans le
rapport de l'agent, jamais improvisé en silence. Il complète les contrats des vagues 1 à 3 (multilingue, erreurs, quotas,
isolation des clients, WebSocket, notifications) ; tout ce qui n'est pas redit ici s'applique tel quel.

## Principes

1. **CamPay isolé** dans `backend/integrations/campay/` : le reste du code ne parle qu'à ces fichiers. Clés **uniquement**
   dans les variables d'environnement. **Aucun test n'appelle le réseau** (`unittest.mock`). Aucune clé réelle dans le dépôt.
2. **Règle d'or** : une commande n'est **payée** qu'après **revérification de la transaction auprès de l'API CamPay**.
   Le contenu d'un webhook, d'une redirection ou d'une requête du navigateur n'est **jamais** une preuve : il ne sert qu'à
   déclencher la revérification (`GET transaction`). Montant, devise et référence externe de la transaction doivent
   correspondre au paiement enregistré, sinon le paiement est marqué `anomalie` et rien n'est encaissé.
3. **Paiement seulement après « Contrat signé »** : commande à l'étape `contrat_signe`, `travaux` ou `terminee`, avec un
   `montant_convenu`. Jamais pour `nouvelle`, `negociation` ou `annulee`. Jamais de montant inventé : le montant maximal
   d'un paiement est le **reste à payer** (`montant_convenu − montant_paye`).
4. **Service non configuré = l'application reste utilisable** : l'API de paiement répond 503
   `{"detail": "…", "code": "paiements_non_configures"}`, le site masque le bouton « Payer », l'équipe peut quand même
   enregistrer un règlement hors ligne. Aucune erreur 500.
5. **Idempotence** : un même paiement ne peut être encaissé qu'une fois, même si le webhook arrive deux fois, en même
   temps que la vérification du navigateur, ou après une expiration. Verrou de ligne (`select_for_update(of=("self",))`)
   dans `paiements/services.py`, vérifié sur PostgreSQL.
6. **Montants** : entiers en FCFA (XAF), plafond `MONTANT_MAX` de `noyau/montants.py`, jamais de décimales.
7. Aucune donnée de démonstration en base. Les numéros de téléphone ne sont jamais écrits dans les journaux et sont
   **masqués** dans les réponses (`+237 6** ** ** 22`).

## Variables d'environnement (à ajouter à `backend/.env.example`)

`CAMPAY_USERNAME`, `CAMPAY_PASSWORD` (existent), `CAMPAY_BASE_URL` (défaut `https://www.campay.net/api`, essais :
`https://demo.campay.net/api`), `CAMPAY_WEBHOOK_KEY` (clé de signature des webhooks), `PAIEMENT_MONTANT_MINIMUM`
(défaut 100), `PAIEMENT_EXPIRATION_MINUTES` (défaut 15). Les adresses de retour utilisent `SITE_URL` ; l'adresse du
webhook (à saisir dans CamPay) est `<API_URL_PUBLIQUE>/api/paiements/webhooks/campay/`.

## Intégration `campay` (agent `integrations`)

Fichiers : `backend/integrations/campay/{__init__.py, client.py, webhooks.py, telephone.py, erreurs.py}` et tests dans
`backend/integrations/campay/tests/`. Dépendance `requests` déjà présente (`PyJWT[crypto]` aussi).

- `configure() -> bool` : vrai si `CAMPAY_USERNAME` et `CAMPAY_PASSWORD` sont présents.
- `telephone.normaliser(texte) -> str` : accepte `6 99 00 11 22`, `+237 699001122`, `00237699001122`, `237699001122` et
  renvoie `237699001122` ; lève `TelephoneInvalide` (hérite de `ValueError`) si ce n'est pas un mobile camerounais
  (`^2376\d{8}$` après nettoyage). `telephone.masquer(numero) -> "+237 6** ** ** 22"`.
- `client.py`, appels HTTP avec délai d'attente 15 s, jamais de secret dans les erreurs ni les journaux :
  - jeton d'accès : `POST {base}/token/` `{username, password}` → `{token, expires_in}`, gardé en mémoire jusqu'à 60 s avant
    l'expiration ; en-tête `Authorization: Token <jeton>` ; un 401 vide le cache et refait **un** essai.
  - `initier_collecte(*, montant, telephone, description, reference_externe) -> Collecte` :
    `POST {base}/collect/` `{amount: "<entier>", currency: "XAF", from: <normalisé>, description, external_reference}` →
    `Collecte(reference, code_ussd, operateur)`.
  - `lien_paiement(*, montant, description, reference_externe, url_retour, url_echec) -> str` :
    `POST {base}/get_payment_link/` → adresse de paiement (carte ou mobile money) ; refuse toute adresse de retour qui
    n'est pas `https://` (ou `http://localhost` en développement).
  - `statut(reference) -> Transaction` : `GET {base}/transaction/<reference>/` →
    `Transaction(reference, statut ('en_attente'|'reussi'|'echoue'), montant (int), devise, operateur, reference_operateur,
    reference_externe, raison)` ; correspondance `PENDING→en_attente`, `SUCCESSFUL→reussi`, `FAILED→echoue`, tout autre
    statut inconnu → `en_attente` (jamais « réussi » par défaut). `reference` est contrôlée (`^[A-Za-z0-9_-]{8,64}$`)
    avant d'être mise dans l'adresse.
- Erreurs (`erreurs.py`) : `CampayNonConfigure` ; `CampayErreurTemporaire` (réseau, délai, 429, 5xx, réponse illisible :
  on réessaiera) ; `CampayErreurDefinitive` (400/401/403, numéro refusé…) avec un attribut `code` parmi `numero_invalide`,
  `montant_invalide`, `refuse`, `inconnue`. Les messages d'erreur ne contiennent ni clé, ni jeton, ni numéro complet.
- `webhooks.py` : `verifier_signature(parametres) -> bool` : la signature est un JWT (HS256) transmis dans le paramètre
  `signature`, signé avec `CAMPAY_WEBHOOK_KEY` ; faux si la clé n'est pas configurée, si la signature est absente ou
  invalide. `analyser(parametres) -> EvenementCampay(reference, reference_externe, statut_annonce)` (valeurs **non
  fiables** : ne servent qu'à retrouver le paiement). Corps invalide ou champs manquants → `None`. **Le format exact des
  webhooks CamPay n'a pas pu être vérifié (pas de réseau) : le coder de façon tolérante (GET ou POST, paramètres de
  requête ou JSON) et le signaler comme réserve.**
- Tests (réseau simulé) : jeton mis en cache, expiration et 401, montants entiers, numéro normalisé, correspondance des
  statuts (un statut inconnu n'est jamais « réussi »), erreurs temporaire/définitive, aucun secret dans les messages,
  adresses de retour refusées, référence contrôlée, signature de webhook valide/invalide/absente/clé manquante.

## Module `paiements` (BF-10, BF-12)

### Modèle `Paiement`

`reference` (« PAY-2026-0001 », compteur de `noyau/references.py`), `commande` (FK PROTECT), `client` (FK, copie du
client de la commande), `montant` (entier FCFA ≥ minimum), `devise` (« XAF »), `mode` (`mobile` | `lien` | `manuel`),
`etat` (`en_attente`, `reussi`, `echoue`, `expire`, `annule`, `anomalie`), `telephone` (chiffres normalisés, mode mobile
seulement), `operateur` (donné par CamPay, jamais deviné), `reference_externe` (aléatoire, `cir-` + 24 caractères
hexadécimaux, envoyée à CamPay, unique), `reference_campay`, `code_ussd`, `lien` (mode lien), `reference_operateur`,
`raison` (code court de l'échec : `numero_invalide`, `refuse`, `expire`, `montant_different`, `inconnue`),
`mode_manuel` (`especes`, `virement`, `cheque`, `autre`) + `note` (≤ 300) + `saisi_par` (FK équipe) pour le mode manuel,
`cree_le`, `derniere_verification_le`, `termine_le`.

Champs ajoutés à `Commande` (migration `commandes`, mise à jour **uniquement** par `paiements/services.py` dans la même
transaction que l'encaissement, `commandes` n'importe jamais `paiements`) : `montant_paye` (entier, défaut 0). Exposés dans
tous les formats de commande (client et équipe) : `montant_paye`, `reste_a_payer` (null si pas de montant convenu),
`statut_paiement` (`non_applicable` avant contrat signé, `non_paye`, `partiel`, `paye`). Filtre équipe
`GET /api/admin/commandes/?paiement=non_paye|partiel|paye`.

### Règles (`paiements/services.py`, `transactions.py`)

- **Initiation** : commande du client, étape autorisée, reste à payer > 0, montant demandé (facultatif : par défaut le
  reste à payer) entre `PAIEMENT_MONTANT_MINIMUM` (ou le reste s'il est plus petit) et le reste à payer. **Un seul paiement
  `en_attente` par commande** (409 `paiement_en_cours`) : un paiement en attente expiré est d'abord clos par la vérification.
  Quota : 5 initiations par heure et par compte (429 `trop_de_paiements`), sous verrou de compte (`verrouiller_compte`).
  Compte équipe : 403 `compte_equipe`. Commande d'un autre client : 404.
- **Mode `mobile`** : `initier_collecte` ; la demande de validation arrive sur le téléphone du client (code USSD
  éventuel dans `code_ussd`). **Mode `lien`** : `lien_paiement` ; le client est redirigé vers CamPay puis revient sur
  `SITE_URL/commandes/<id>/payer?paiement=<id>`. Erreur définitive de CamPay → paiement `echoue` avec `raison` ;
  erreur temporaire → 503 `paiements_indisponibles`, aucun paiement créé.
- **Vérification** (`verifier(paiement)`) : appelle `statut(reference_campay)`. `reussi` **et** montant, devise,
  `reference_externe` identiques → `reussi`, `commande.montant_paye += montant`, signal `paiement_reussi`, diffusion en
  direct. `reussi` mais différent → `anomalie` (rien d'encaissé, signal à l'équipe). `echoue` → `echoue` + `raison`.
  `en_attente` plus vieux que `PAIEMENT_EXPIRATION_MINUTES` → `expire`. Un paiement déjà final n'est **jamais** modifié
  par une vérification ultérieure (sauf `expire` → `reussi` si CamPay confirme la réussite, alors encaissé une seule
  fois). Le reste à payer n'est jamais dépassé : si l'encaissement le dépassait (deux paiements validés ensemble), le
  paiement passe en `anomalie` avec `raison: "montant_different"` et l'équipe est prévenue (remboursement hors application).
- **Webhook** `GET|POST /api/paiements/webhooks/campay/` (sans JWT) : signature vérifiée (`integrations.campay.webhooks`),
  paiement retrouvé par `reference_externe` ou `reference_campay`, puis **toujours** `verifier(paiement)`. Réponse 200
  `{"ok": true}` même si le paiement est inconnu (pas d'information donnée à l'appelant) ; 403 si la signature est
  absente ou fausse ; 503 `webhook_non_configure` si `CAMPAY_WEBHOOK_KEY` est vide.
- **Règlement hors ligne** (équipe) : mode `manuel`, créé directement `reussi` (jamais de revérification, acteur et motif
  enregistrés), même limite du reste à payer, commande à une étape autorisée.
- **Annulation** : le client peut annuler un paiement `en_attente` **mode lien** n'ayant pas été confirmé (`annule`) ;
  un paiement mobile en attente ne s'annule pas (la demande est déjà sur le téléphone), il expire.
- Commande `python manage.py reverifier_paiements` : vérifie tous les paiements `en_attente` (au plus un appel par
  paiement toutes les 5 secondes, délai entre deux vérifications `derniere_verification_le`), ajoutée à la boucle du worker
  (`envoyer_emails --boucle`). Une panne de CamPay ne fait jamais échouer le worker (journalisée).
- Signaux (`paiements/signals.py`) : `paiement_reussi(paiement)`, `paiement_echoue(paiement)`, `paiement_anomalie(paiement)`
  auxquels `notifications` s'abonne (voir plus bas). Diffusion en direct via `apps/noyau/direct.py` :
  `{"type": "paiement_mis_a_jour", "paiement": <Paiement>}` au client concerné et à l'équipe (`publier_equipe`).

### API client `/api/paiements/` (`EstClient`)

- `GET disponibilite/` → `{configure: bool, montant_minimum: int, expiration_minutes: int}` (valeurs de
  `PAIEMENT_MONTANT_MINIMUM` et `PAIEMENT_EXPIRATION_MINUTES`, renvoyées même si `configure` est faux).
- `POST /` JSON `{commande: <id>, mode?: "mobile"|"lien", telephone?: "6 99 00 11 22", montant?: <int>}` → 201 `<Paiement>`.
  `telephone` obligatoire en mode mobile (400 `telephone` si invalide). Erreurs : 400 (`montant`, `telephone`), 404,
  409 `paiement_en_cours`, 409 `paiement_non_autorise` (étape ou rien à payer), 429 `trop_de_paiements`, 503
  `paiements_non_configures` ou `paiements_indisponibles`.
- `GET /` paginé `?commande=<id>&etat=` : ses propres paiements. `GET <id>/` → `<Paiement>` ; si l'état est `en_attente`,
  le serveur **revérifie auprès de CamPay** (au plus une fois toutes les 3 secondes par paiement) avant de répondre.
- `POST <id>/annuler/` (mode lien en attente) → `<Paiement>`.
- `GET <id>/recu/` → `{paiement: <Paiement>, commande: {id, reference}, client: {nom_complet}, emetteur: {nom: "Complexe Industriel
  Révélation SARL", ville: "Douala"}, montant_paye_total, reste_a_payer}` seulement si `etat == "reussi"` (404 sinon).

`<Paiement>` : `{id, reference, commande: {id, reference}, montant, devise, mode, etat, etat_libelle, operateur,
telephone_masque, code_ussd, lien, raison, raison_libelle, cree_le, termine_le, peut_annuler}` ; `*_libelle` traduits selon
`Accept-Language`. Aucune clé, aucun numéro complet, aucune référence interne CamPay côté client.

### API équipe `/api/admin/paiements/` (`EstEquipe`)

- `GET /` paginé `?etat=&mode=&commande=&search=` (référence, client, référence de commande) → `<PaiementEquipe>` =
  `<Paiement>` + `{client: {id, nom_complet}, reference_campay, reference_operateur, saisi_par, mode_manuel, note,
  derniere_verification_le}`. `GET <id>/`.
- `POST <id>/reverifier/` → `<PaiementEquipe>` (états `en_attente`, `expire`, `anomalie`).
- `POST commandes/<commande_id>/reglements/` `{montant, mode_manuel: "especes"|"virement"|"cheque"|"autre", note?}` →
  201 `<PaiementEquipe>` (règlement hors ligne). 409 `paiement_non_autorise`, 400 `montant`.
- `GET resume/` → `{en_attente, anomalies, encaisse_mois}` (`encaisse_mois` seulement pour le super-administrateur, sinon
  null).

### Notifications (ajouts à `apps/notifications/evenements.py`, traduits dans les 5 langues)

| Type | Destinataire | Application | E-mail |
|---|---|---|---|
| `paiement_recu` | le client | oui | oui (reçu : référence, montant, reste à payer) |
| `paiement_recu_equipe` | l'équipe | oui | oui (si `email_equipe`) |
| `paiement_echoue` | le client | oui | non |
| `paiement_anomalie` | l'équipe | oui | oui (si `email_equipe`) |

Ces types s'ajoutent aux événements de `ModeleEmail` (les trois qui envoient un e-mail). Liens : client `/commandes/<id>`,
équipe `/commandes/<id>`.

## Module `statistiques` (BF-16)

Pas de modèle de données propre : tout est calculé à la lecture à partir des tables existantes (`indicateurs.py`,
requêtes agrégées côté base, sans boucle par commande ; mises en cache 60 secondes par période, jamais de donnée
personnelle). Fuseau horaire `Africa/Douala`. API **équipe seulement** : `/api/admin/statistiques/`.

- `GET resume/?du=AAAA-MM-JJ&au=AAAA-MM-JJ` (par défaut : 30 derniers jours ; période de 366 jours au plus, sinon 400) →
  ```
  {periode: {du, au},
   commandes: {total, par_etape: {nouvelle, negociation, contrat_signe, travaux, terminee, annulee},
               par_type_batiment: {maison, industrie, entreprise}, nouvelles, signees, taux_signature (0..1|null),
               delai_moyen_signature_jours (null si aucune)},
   a_traiter: {commandes_nouvelles, propositions_en_attente_equipe, devis_a_envoyer, demandes_rendu, demandes_contact,
               messages_non_lus, appels_manques, paiements_anomalies},
   montants: {chiffre_convenu, encaisse, reste_a_encaisser, nombre_paiements, panier_moyen} | null,
   top_produits: [{produit_nom, produit_reference, commandes}] (5 au plus)}
  ```
  `montants` est **null sauf pour le super-administrateur** (les membres simples voient les volumes, pas les sommes). Le
  champ `a_traiter` ne dépend pas de la période (état actuel).
- `GET evolution/?mois=12` (1 à 24, défaut 12) → `{mois: [{mois: "2026-10", commandes, signees, encaisse|null}]}` du plus ancien au
  plus récent, tous les mois présents (valeur 0 si rien).
- Permissions : `EstEquipe`. Tests : exactitude sur des jeux de données construits, fuseau (une commande à 23 h 30
  heure de Douala le dernier jour du mois), période invalide, `montants` caché pour un membre simple, aucune requête N+1
  (nombre de requêtes borné), cache.

## Site public (agent `site`)

Module `src/modules/paiements/` : route protégée `/commandes/:id/payer` (`PaiementPage`, chargée à la demande) et
`/paiements/:id/recu` (`RecuPage`, feuille de style d'impression ; le bouton « Imprimer / enregistrer en PDF » appelle
`window.print()`). Dans `DetailCommande` : bloc « Paiement » (montant convenu, déjà payé, reste à payer, statut, liste des
paiements avec état), bouton « Payer » **seulement** si le contrat est signé, le reste est > 0 et `GET disponibilite/`
renvoie `configure: true` ; sinon explication claire (« paiement bientôt disponible » ou « règlement avec l'équipe »).

- `PaiementPage` : choix « Payer le reste (X FCFA) » ou « Autre montant » (champ entier, borné par le reste et le minimum, erreurs
  du serveur affichées au champ) ; mode « Mobile Money (MTN / Orange) » avec numéro de téléphone (pré-rempli avec celui du
  profil, format libre, aide « 6 99 00 11 22 »), ou « Carte / lien de paiement » (redirection vers l'adresse reçue) ;
  après l'envoi, écran d'attente accessible (`role="status"`) : « Validez le paiement sur votre téléphone », code USSD
  s'il existe, compte à rebours indicatif, **mise à jour en direct** (trame `paiement_mis_a_jour` du WebSocket
  existant, avec repli sur `GET <id>/` toutes les 4 s), états finaux : réussi (reçu, retour à la commande), échoué
  (raison traduite, « Réessayer »), expiré (« Recommencer »), anomalie (« Votre paiement est en cours de vérification par l'équipe »).
  Retour de la redirection : lit `?paiement=<id>` et interroge le serveur, **ne croit jamais l'adresse**.
- Tous les montants avec `@partage/utils/format.js`. Tous les textes dans les 5 fichiers i18n ; aucun texte en dur ; aucun
  numéro complet affiché (seulement `telephone_masque`) ; jamais de prix inventé.
- Accessibilité : libellés de formulaire, cibles ≥ 44 px, `prefers-reduced-motion`, message d'attente annoncé poliment.
- Tests : API et WebSocket simulés ; double clic sur « Payer » n'envoie qu'une demande ; reprise d'un paiement en attente
  au rechargement ; bouton masqué si non configuré ; adresse de retour falsifiée sans effet.

## Tableau de bord (agent `tableau-de-bord`)

Menu : `paiements` et `statistiques` passent de « À venir » à « Pilotage » (pastille de `paiements/resume/` : anomalies et
paiements en attente). Accueil : le bloc d'indicateurs existant utilise `statistiques/resume/` (sans casser ce qui existe).

- `/paiements` (`PaiementsPage`) : liste filtrable (état, mode, recherche), pastille anomalie, détail dans un volet
  (références, opérateur, état, raison traduite, date de dernière vérification, bouton « Revérifier » pour
  `en_attente`/`expire`/`anomalie`, lien vers la commande). Le numéro de téléphone n'apparaît que masqué.
- Fiche commande : bloc « Paiements » (montant convenu, payé, reste, statut, liste) et bouton « Enregistrer un règlement
  hors ligne » (montant ≤ reste, mode espèces/virement/chèque/autre, note ; confirmation avant l'envoi ; message clair si le
  montant dépasse le reste). Liste des commandes : colonne et filtre « paiement » (non payé / partiel / payé).
- `/statistiques` (`StatistiquesPage`) : sélecteur de période (7 jours, 30 jours, mois en cours, 12 mois, dates libres) ;
  cartes d'indicateurs (commandes, signées, taux de signature, délai moyen, et pour le super-administrateur chiffre convenu,
  encaissé, reste à encaisser) ; « À traiter » avec liens vers les écrans concernés ; graphique d'évolution mensuelle
  (barres SVG légères, **sans bibliothèque**, avec un tableau équivalent masqué visuellement pour les lecteurs d'écran, couleurs
  de la charte, motif `prefers-reduced-motion`) ; répartition par étape et par type de bâtiment ; top produits. Un membre
  simple ne voit aucune somme (les cartes d'argent sont absentes, pas à zéro). Aucune donnée inventée : état vide clair.
- Tous les textes dans les 5 fichiers i18n. Libellés d'état et de raison fournis par le serveur (déjà traduits).
- Tests : API simulée ; sommes cachées pour un membre simple ; période invalide ; état vide ; accessibilité du graphique.

## Sécurité à vérifier par les testeurs

Revérification obligatoire (un webhook faux, un webhook sans signature, un navigateur qui annonce « réussi » n'encaissent
rien), montant/devise/référence différents → anomalie, idempotence (deux webhooks et une vérification simultanés, une
seule écriture dans `montant_paye`, sur PostgreSQL), dépassement du reste à payer, un seul paiement en attente par commande,
quotas, isolation (un client ne voit ni ne vérifie le paiement d'un autre, 404), compte équipe refusé à l'initiation,
règlement hors ligne réservé à l'équipe et tracé, aucun secret ni numéro complet dans les réponses et les journaux,
étapes interdites (nouvelle, négociation, annulée), montants entiers plafonnés, statistiques exactes et sommes cachées
aux membres simples, traductions complètes (`test_langues`).
