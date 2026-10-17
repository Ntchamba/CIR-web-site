# Vague 2 : contrat d'API (selection, commandes, devis, contact)

Rédigé par le coordinateur le 17 octobre 2026. Les agents `backend`, `site` et `tableau-de-bord` travaillent en
parallèle à partir de ce contrat : le back-end l'implémente, les front-ends le consomment (en tests, l'API est
simulée). Tout écart nécessaire est signalé dans le rapport de l'agent, jamais improvisé en silence.
Il complète `vague-1-contrat-api.md` (règles communes : multilingue, médias, pagination, prix) ; tout ce qui n'est
pas redit ici s'applique tel quel.

## Périmètre et limites

- **Pas d'e-mails ni de notifications** dans cette vague (module `notifications`, vague 3) : client et équipe
  voient les changements dans l'application. **Pas de messagerie** (vague 3) : la discussion passe par les
  `message` des propositions et par la `reponse_equipe` des demandes. **Pas de paiement** (vague 4).
- **Pas de PDF** : le devis et le contrat s'affichent à l'écran, avec une feuille de style d'impression
  (`@media print`). Un PDF sera décidé plus tard (il demande une bibliothèque).
- Le **tableau de bord n'a pas de page pour `selection`** (la sélection n'apparaît que dans la commande).
- Contenu écrit par les clients ou l'équipe (descriptions, messages, motifs, notes, réponses) : **non traduit**,
  affiché tel quel. Textes du système (libellés, erreurs) : traduits comme partout.
- Chaque nouveau message `_()` : traduit dans les 4 `.po`, puis `compiler_traductions`.

## Règles communes de la vague

- **Argent** : entiers en FCFA, renvoyés en **chaîne** (`"125000"`) ou `null` ; acceptés en nombre ou en chaîne.
  **Surfaces** : décimales à 2 chiffres en chaîne (`"42.50"`). Dates ISO ; `date_*` sans heure en `YYYY-MM-DD`.
  Côté front : `fcfa()`, `surface()`, `date()` de `@partage/utils/format.js`. **Jamais de prix inventé** : un prix
  absent reste vide (« Prix sur devis » pour un produit) ; seul le calcul arithmétique de l'équipe fait foi.
- **Clients seulement** : ajouter `EstClient` à `apps/noyau/permissions.py` (rôle `client`, compte actif). Les
  comptes de l'équipe reçoivent 403 sur les routes client qui créent ou modifient (commander, sélectionner,
  demander un rendu) ; ils passent par `/api/admin/…`.
- **Isolation** : un client ne voit **que ses propres** commandes, sélections, demandes et devis (404, pas 403,
  pour l'objet d'un autre). Les `notes_internes` et le détail des autres clients ne sortent jamais des routes
  `/api/admin/…`.
- **Erreurs** : 400 `{champ: [messages]}` ou `{"detail": "…"}` ; 403 `{"detail": "…", "code": "<code>"}` quand le
  front doit réagir (codes ci-dessous) ; 404 ; 429 (quotas). Messages traduits (`Accept-Language`).
- **Quotas** : 5 commandes par jour et par compte, 5 demandes de rendu par jour et par compte, contact 5 par
  heure et par adresse IP (`REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["contact"]`) et 10 par jour et par compte
  connecté, sélection de 50 éléments au plus.
- Listes paginées `{count, next, previous, results}` (24 par page, `?taille=` jusqu'à 100) sauf mention.
- `ordering` par défaut : plus récent d'abord.

## Module `selection` (BF-09)

Modèle `ElementSelection` : `utilisateur` (client), `produit` (catalogue), `design` (FK facultative, doit appartenir
au produit), `cree_le` ; unique sur (utilisateur, produit, design). Réservé aux clients connectés (un visiteur est
invité à se connecter ; le site garde alors `?suite=`).

API `/api/selection/` (client connecté, `EstClient`) :
- `GET /` → `{count, elements: [{id, produit: {id, slug, reference, nom, famille: {slug, nom}, image: {url, alt}|null,
  prix, unite_prix}, design: {id, nom, couleur, image: {url, alt}|null}|null, ajoute_le, disponible}]}` (pas de
  pagination, 50 au plus). `disponible` est faux si le produit est passé hors ligne : l'élément reste visible pour
  pouvoir le retirer, mais ne peut pas être commandé.
- `GET resume/` → `{count, produits: [<id produit>, …]}` (léger, pour griser les boutons « Ajouter »).
- `POST /` `{produit: <id>, design?: <id>}` → 201 `element` (200 s'il existait déjà). 400 si produit hors ligne ou
  inconnu, design d'un autre produit, ou plus de 50 éléments.
- `DELETE <id>/` → 204. `DELETE /` (vider) → 204.

## Module `commandes` (BF-10, BF-12, BF-13, BF-16)

### Règles métier (dans `commandes/services.py`, `etapes.py`, `negociation.py`, `contrats.py`)

1. **Commander exige un compte client actif ET une adresse complète** (ville, quartier, rue ou repère), vérifié côté
   serveur avec `comptes.services.peut_commander`. Sinon 403 `{"detail": "…", "code": "adresse_incomplete"}`.
   Compte de l'équipe : 403 `code: "compte_equipe"`.
2. L'adresse du chantier est **copiée** de l'adresse du client à la création (instantané) ; on peut la corriger
   avant la commande via le profil.
3. **Étapes** (`etat`) : `nouvelle`, `negociation`, `contrat_signe`, `travaux`, `terminee`, `annulee`
   (mêmes clés que `STATUTS` de `@partage/utils/format.js`). Transitions autorisées, et qui les fait :

   | De | Vers | Par |
   |---|---|---|
   | `nouvelle` | `negociation` | automatique, à la première proposition (client ou équipe) |
   | `nouvelle`, `negociation` | `annulee` | le client ou l'équipe |
   | `negociation` | `contrat_signe` | **uniquement** en acceptant une proposition (voir 4) |
   | `contrat_signe` | `travaux` | l'équipe |
   | `contrat_signe` | `annulee` | l'équipe seulement |
   | `travaux` | `terminee` | l'équipe |

   `terminee` et `annulee` sont définitives. Toute autre transition : 400 `{"detail": "…"}`.
4. **Négociation** : une `Proposition` = `prix_m2` (entier ≥ 0, facultatif), `total` (entier ≥ 0, facultatif),
   `delai_jours` (entier ≥ 1, facultatif), `message` (≤ 1000). Il faut au moins `prix_m2` ou `total`. Si la surface de
   la commande est connue et que `total` manque, le serveur le calcule (`round(prix_m2 × surface)`, arrondi
   à l'entier le plus proche, demi vers le haut) ; si les deux sont donnés et diffèrent de plus de 1 FCFA du calcul,
   400 sur `total`. Une seule proposition `en_attente` à la fois : une nouvelle proposition de **l'autre partie** est
   une **contre-proposition** (l'ancienne passe à `remplacee`) ; la même partie peut aussi **réviser** la sienne
   (l'ancienne passe à `remplacee`). Proposer est possible en `nouvelle` et `negociation` seulement.
   **Accepter** : seulement par l'autre partie que l'auteur ; la proposition passe à `acceptee`, la commande à
   `contrat_signe`, et fixe `montant_convenu` (= `total`, ou `prix_m2 × surface` si le total manque), `prix_m2_convenu`,
   `delai_convenu_jours`, `signe_le`. Impossible si aucun montant ne peut être déterminé (400 « précisez la
   surface »). **Refuser** : seulement par l'autre partie ; la proposition passe à `refusee`, la commande reste en
   `negociation`. Toute réponse à une proposition qui n'est plus `en_attente` : 400.
5. **Contrat** (`contrats.py`) : la commande signée expose un objet `contrat` en lecture seule
   `{reference, signe_le, accepte_par: "client"|"equipe", client: {nom_complet, email, telephone}, adresse, lignes,
   montant, prix_m2, delai_jours, proposition: <id>}` (pas de PDF).
6. Signaux Django `proposition_acceptee`, `proposition_refusee`, `proposition_remplacee` (module
   `commandes/signals.py`, argument `proposition`) : le module `devis` s'y abonne ; `commandes` n'importe jamais
   `devis` (pas de dépendance circulaire ; `Proposition.devis` est une FK vers `"devis.Devis"` en chaîne).
7. Chaque changement d'étape écrit une ligne d'historique (`ChangementEtat` : `de`, `vers`, `auteur`, `cree_le`).

### Modèles

- `Commande` : `reference` (« CIR-2026-0001 », unique, séquentielle par année, sûre en cas de créations simultanées),
  `client` (FK PROTECT), `type_batiment` (`maison`, `industrie`, `entreprise`), `etat`, `ville`, `quartier`,
  `rue_ou_repere` (instantané), `surface_m2` (null), `description` (≤ 1500), `montant_convenu` (null),
  `prix_m2_convenu` (null), `delai_convenu_jours` (null), `signe_le` (null), `notes_internes` (équipe seulement),
  `cree_le`, `modifie_le`.
- `LigneCommande` : `commande`, `produit` (FK SET_NULL), `design` (FK SET_NULL), instantané `produit_nom`,
  `produit_reference`, `design_nom` (français, pour garder l'historique si le catalogue change).
- `Proposition` : `commande`, `auteur` (FK utilisateur), `auteur_role` (`client`|`equipe`), `prix_m2`, `total`,
  `delai_jours`, `message`, `etat` (`en_attente`, `acceptee`, `refusee`, `remplacee`), `devis` (FK null),
  `cree_le`, `repondu_le`.
- `ChangementEtat` (voir règle 7).

### API client `/api/commandes/` (`EstClient`)

- `GET /` paginé, `?etat=` → `[{id, reference, type_batiment, etat, surface_m2, nombre_lignes, montant_convenu,
  action_requise, modifie_le, cree_le}]`. `action_requise` : vrai si une proposition **de l'équipe** attend la
  réponse du client.
- `POST /` `{type_batiment, surface_m2?, description?, lignes?: [{produit: <id>, design?: <id>}],
  depuis_selection?: bool}` → 201 détail. Au moins une ligne (directe, ou issue de la sélection avec
  `depuis_selection: true`, la sélection étant alors vidée après succès, dans la même transaction). Produits hors
  ligne : 400. Règles 1 et 2 ; quota (429).
- `GET <id>/` → `{id, reference, type_batiment, etat, surface_m2, description, adresse: {ville, quartier,
  rue_ou_repere}, lignes: [{id, produit: {id, slug, reference, nom, image}|null, design: {id, nom, couleur}|null}],
  montant_convenu, prix_m2_convenu, delai_convenu_jours, signe_le, propositions: [Proposition], historique:
  [{de, vers, par: "client"|"equipe", cree_le}], contrat: {…}|null, devis: [DevisResume envoyés], action_requise,
  actions_possibles, cree_le, modifie_le}`. `produit.nom` est le nom **traduit** du produit courant, à défaut
  l'instantané. `Proposition` : `{id, auteur_role, auteur_nom, prix_m2, total, delai_jours, message, etat, devis: <id>|null,
  peut_repondre, cree_le, repondu_le}` (`peut_repondre` : vrai si la proposition est `en_attente` et que
  l'auteur est l'autre partie, c'est-à-dire que **le demandeur** peut l'accepter ou la refuser).
- `actions_possibles` (calculé par le serveur, le front ne recalcule rien) : pour un client, sous-ensemble de
  `["modifier", "annuler", "proposer"]` ; pour l'équipe, de `["modifier", "annuler", "proposer", "demarrer_travaux",
  "terminer"]`.
- `PATCH <id>/` `{surface_m2?, description?}` : seulement en `nouvelle` (sinon 400).
- `POST <id>/annuler/` `{motif?}` → détail (règle 3). Le motif est gardé dans l'historique.
- `POST <id>/propositions/` `{prix_m2?, total?, delai_jours?, message?}` → 201 `Proposition`.
- `POST <id>/propositions/<pid>/accepter/` et `…/refuser/` `{message?}` → détail de la commande.

### API équipe `/api/admin/commandes/` (`EstEquipe`)

- `GET /` paginé : `?etat=`, `?type=`, `?search=` (référence, nom, e-mail, téléphone du client), `?client=<id>`,
  `?action_requise=1` → `[{id, reference, type_batiment, etat, surface_m2, nombre_lignes, montant_convenu,
  client: {id, nom_complet, email, telephone, ville}, action_requise, modifie_le, cree_le}]`. `action_requise`
  (équipe) : vrai pour une commande `nouvelle`, ou dont une proposition **du client** attend la réponse de l'équipe.
- `GET resume/` → `{nouvelle, negociation, contrat_signe, travaux, terminee, annulee, total, action_requise}`.
- `GET <id>/` : le détail client + `client: {id, nom_complet, email, telephone, ville, quartier, rue_ou_repere,
  langue}`, `notes_internes`, et `devis: [DevisResume]` (tous, brouillons compris).
- `PATCH <id>/` `{surface_m2?, notes_internes?}` (la surface reste modifiable tant que la commande n'est pas
  `contrat_signe` ou au-delà ; les notes toujours, y compris après clôture).
- `POST <id>/etat/` `{etat: "travaux"|"terminee"|"annulee", motif?}` → détail (règle 3 ; `negociation` et
  `contrat_signe` ne se posent jamais à la main).
- `POST <id>/propositions/`, `POST <id>/propositions/<pid>/accepter|refuser/` : comme côté client, avec
  `auteur_role = "equipe"`.

## Module `devis` (BF-11, BF-12)

### Calcul (dans `devis/calcul.py`, **seule source de vérité** : le front l'appelle, ne le recopie pas)

Trois types de ligne (`type_ligne`) :
- `materiau` : `quantite_kg = arrondi_2(surface_m2 × dosage_kg_m2)` puis `montant = round(quantite_kg × prix_kg)` ;
- `surface` : `montant = round(surface_m2 × prix_m2)` (pose comprise ou non, dit par le libellé) ;
- `forfait` : `montant` saisi.

Arrondis en `Decimal`, demi vers le haut ; `total` = somme des montants des lignes. Le prix d'une ligne est **saisi
par l'équipe** ; l'éditeur peut le préremplir avec le prix du produit du catalogue **s'il existe**, sinon il reste
vide et le devis ne peut pas être envoyé tant qu'il manque (jamais de prix inventé).

### Modèles

- `DemandeRendu` : `reference` (« REN-2026-0001 »), `client`, `description` (20 à 1500), `type_batiment`,
  `surface_m2` (null), `produit` (FK null, produit de référence), `commande` (FK null, une commande du client),
  `etat` (`nouvelle`, `en_etude`, `devis_envoye`, `close`), `reponse_equipe`, `notes_internes`, `cree_le`,
  `modifie_le`.
- `ImageDemande` : `demande`, `image` (WebP 1280), `ordre` (5 au plus par demande ; erreur d'image → 400 sur `images`).
- `Devis` : `reference` (« DEV-2026-0001 »), `commande` (FK obligatoire), `demande` (FK null), `etat` (`brouillon`,
  `envoye`, `accepte`, `refuse`, `remplace`), `validite_jours` (défaut 30), `notes` (≤ 1000), `envoye_le`,
  `cree_par`, `cree_le`, `modifie_le` ; propriétés `valide_jusqu_au` (date) et `expire` (vrai si `envoye` et date passée).
- `LigneDevis` : `devis`, `ordre`, `type_ligne`, `libelle` (≤ 160 ; vide avec `produit` → nom traduit du produit),
  `produit` (FK null), `surface_m2`, `dosage_kg_m2`, `prix_kg`, `prix_m2`, `montant_forfait`, et calculés en
  lecture `quantite_kg`, `montant`.

### API client `/api/devis/` (`EstClient`)

- `POST demandes-rendu/` multipart `{description, type_batiment, surface_m2?, produit?: <id>, commande?: <id de ses
  commandes>, images?: [fichiers ≤ 5]}` → 201 `DemandeRendu`. Quota (429).
- `GET demandes-rendu/` paginé et `GET demandes-rendu/<id>/` → `{id, reference, description, type_batiment,
  surface_m2, produit: {id, slug, reference, nom}|null, commande: <id>|null, images: [{url, alt: ""}], etat,
  reponse_equipe, devis: [DevisResume], cree_le}`.
- `GET /` paginé : **ses** devis envoyés, acceptés, refusés ou remplacés (jamais les brouillons) → `DevisResume` :
  `{id, reference, commande: <id>, commande_reference, etat, expire, total, valide_jusqu_au, envoye_le}` ;
  `GET <id>/` → `DevisResume` + `{lignes: [{ordre, type_ligne, libelle, surface_m2, dosage_kg_m2, quantite_kg, prix_kg,
  prix_m2, montant}], notes}`. Lecture seule : le client répond par la négociation de la commande.

### API équipe `/api/admin/devis/` (`EstEquipe`)

- `GET /` paginé `?commande=<id>`, `?etat=`, `?search=` ; `POST /` `{commande: <id>, demande?: <id>, validite_jours?,
  notes?, lignes: [{type_ligne, libelle?, produit?, surface_m2?, dosage_kg_m2?, prix_kg?, prix_m2?,
  montant_forfait?}]}` → 201 brouillon. Une commande `terminee` ou `annulee` : 400.
- `GET/PATCH/DELETE <id>/` : modifiable (et supprimable) **seulement en `brouillon`** ; `lignes` est **remplacée en
  entier** à l'écriture. Détail : champs du client + `commande`, `demande`, `notes`, `cree_par`.
- `POST calculer/` `{lignes: […]}` → `{lignes: [{…champs calculés}], total, complet: bool, erreurs: [{ligne, champ,
  message}]}` (aperçu sans rien enregistrer ; `complet` est faux s'il manque un prix ou une surface).
- `POST <id>/envoyer/` : exige un devis `complet` et `total > 0` ; passe à `envoye` (`envoye_le`), **crée une
  proposition de l'équipe** sur la commande (`total` = total du devis, `message` = notes, `devis` = ce devis ;
  la commande passe en `negociation` si elle était `nouvelle` ; l'éventuelle proposition en attente est remplacée).
  Réponse : le devis.
- Réaction aux signaux de `commandes` : proposition acceptée → devis `accepte` ; refusée → `refuse` ;
  remplacée → `remplace`. Une demande de rendu liée passe à `devis_envoye` à l'envoi.
- `GET/PATCH demandes-rendu/…` : `GET /` paginé `?etat=`, `?search=` ; `GET <id>/` ; `PATCH <id>/` `{etat?,
  reponse_equipe?, notes_internes?}` ; `GET resume/` → `{nouvelle, en_etude, devis_envoye, close, total}`.
  Détail équipe : champs client + `client: {id, nom_complet, email, telephone}`, `notes_internes`.

## Module `contact` (BF-11, BF-13)

Modèle `DemandeContact` : `reference` (« CTC-2026-0001 »), `auteur` (FK null : visiteur), `nom`, `email`,
`telephone`, `type` (`question`, `rappel`), `creneau` (`matin`, `apres_midi`, `soir`, `peu_importe`, pour un
rappel), `message` (≤ 1000), `produit` (FK null, contexte), `langue` (code court de la requête), `etat`
(`nouvelle`, `en_cours`, `traitee`), `reponse_equipe`, `notes_internes`, `cree_le`, `traitee_le`.

Règles : visiteur → `nom` et (`email` ou `telephone`) obligatoires ; `rappel` → `telephone` obligatoire ; un client
connecté peut omettre `nom`/`email`/`telephone` (repris de son compte). `message` : 5 à 1000 caractères. Anti-robot :
champ piège `site_web` (doit rester vide : s'il est rempli, réponse 201 factice et **rien n'est enregistré**) +
quotas. Pas de lien (`http`) dans `message` pour un visiteur.

- Public `POST /api/contact/demandes/` `{nom?, email?, telephone?, type, creneau?, message, produit?: <id>,
  site_web?}` → 201 `{id, reference}`.
- Client connecté `GET /api/contact/demandes/miennes/` paginé → `{id, reference, type, creneau, message, produit:
  {slug, nom}|null, etat, reponse_equipe, cree_le, traitee_le}` (aucun suivi pour les visiteurs, faute de compte).
- Équipe `/api/admin/contact/demandes/` : `GET /` paginé `?etat=`, `?type=`, `?search=` ; `GET <id>/` ; `PATCH <id>/`
  `{etat?, reponse_equipe?, notes_internes?}` (`traitee_le` posé en passant à `traitee`) ; `GET resume/` →
  `{nouvelle, en_cours, traitee, total}`. Les champs de l'équipe ajoutent `nom`, `email`, `telephone`, `langue`,
  `auteur: {id, nom_complet}|null`, `notes_internes`.

## Site public (agent `site`)

Routes (chargées à la demande ; protégées = `RouteProtegee`, retour par `?suite=`) :

| Chemin | Page | Accès |
|---|---|---|
| `/selection` | `SelectionPage` | protégée |
| `/commandes` | `CommandesPage` (remplace « Bientôt disponible ») | protégée |
| `/commandes/nouvelle` | `NouvelleCommandePage` | protégée |
| `/commandes/:id` | `DetailCommande` (`EtapesCommande`, `Negociation`, `ApercuDevis`, contrat) | protégée |
| `/devis/demande` | `DemandeRenduPage` | protégée |
| `/contact` | page avec `SectionContact` (aussi en bas de l'accueil) | publique |
| `/mes-demandes` | `MesDemandesPage` (demandes de contact et de rendu) | protégée |

- `SelectionContext` (fournisseur dans `App`, chargé seulement si connecté) : `resume`, `ajouter`, `retirer`, `vider`,
  `estSelectionne(produitId)`, nombre pour l'en-tête. `BoutonSelection` (carte produit et fiche produit :
  `PanneauOptions` remplace « La commande en ligne arrive bientôt » par « Ajouter à ma sélection » et « Commander »).
  Visiteur : le bouton mène à la connexion (`?suite=` sur la page du produit).
- `NouvelleCommandePage` : type de bâtiment, surface, description, lignes issues de la sélection. **Adresse
  incomplète** (profil sans ville, quartier ou repère) : on n'affiche pas le formulaire, mais un message clair et
  un lien vers `/compte` (la règle est aussi vérifiée par le serveur, `code: "adresse_incomplete"`, traité de la même
  façon). Succès → `/commandes/<id>`.
- `EtapesCommande` : frise des étapes (`nouvelle` → `negociation` → `contrat_signe` → `travaux` → `terminee`, `annulee`
  à part) avec l'historique et les dates ; accessible (liste ordonnée, étape courante annoncée).
- `Negociation` : proposition en cours (`peut_repondre` → boutons Accepter / Refuser / Contre-proposer), formulaire de
  proposition (prix au m², total, délai, message ; totaux affichés avec `fcfa()`), historique des propositions
  (état, auteur, date), message de confirmation à l'acceptation (« Contrat signé »), résumé du contrat. Les boutons
  suivent **uniquement** `actions_possibles` et `peut_repondre` ; confirmation avant d'accepter et d'annuler.
- `ApercuDevis` : devis envoyés (lignes, total, validité, `expire`) avec feuille d'impression ; lien vers la
  négociation. `DemandeRenduPage` : description, type, surface, produit de référence (liste du catalogue), images
  (aperçu, 5 au plus), succès → `/mes-demandes`.
- `SectionContact` : formulaire question ou rappel (créneau), champ piège `site_web` masqué (`aria-hidden`,
  `tabIndex=-1`), préremplissage depuis le compte, message de succès, erreurs sous les champs, 429 traduit.
- Pied de page : lien « Contact » ; compte (`ProfilPage`) : liens « Mes commandes », « Mes demandes », « Ma sélection ».
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js` ; aucun prix inventé ; états vides traduits.

## Tableau de bord (agent `tableau-de-bord`)

- Menu : `commandes`, `devis`, `contact` passent de « À venir » à « Pilotage », avec une **pastille** du nombre
  d'éléments à traiter (`resume/` : `action_requise`, `nouvelle`), rechargée à la navigation.
- `/commandes` : onglets par étape avec leurs nombres (`resume/`), recherche, filtre « action requise », tableau
  paginé (référence, client avec liens `tel:` et `mailto:`, type, surface, montant, étape, dernière activité).
- `/commandes/:id` : client (coordonnées, adresse du chantier, langue), lignes (produit, design), surface
  modifiable, frise des étapes avec boutons selon `actions_possibles` (« Démarrer les travaux », « Terminer »,
  « Annuler » avec motif, confirmations), panneau de négociation (même logique que le site, côté équipe),
  devis liés (lien vers l'éditeur, bouton « Créer un devis »), `NotesInternes` (enregistrement explicite, jamais
  visibles du client), contrat quand signé.
- `/devis` : deux onglets, **Devis** (liste, état, total, commande liée) et **Demandes de rendu** (boîte de
  réception : état, réponse à l'équipe, images en grand, lien vers la commande/le client, bouton « Créer un devis »).
  `/devis/nouveau?commande=<id>` et `/devis/:id` : `EditeurDevis` (lignes des trois types, aperçu par
  `POST calculer/` avec délai de saisie, erreurs par ligne, préremplissage du prix depuis le catalogue seulement s'il
  existe, validité, notes, « Enregistrer », « Envoyer au client » avec confirmation ; lecture seule hors brouillon).
- `/contact` : `DemandesPage` (boîte de réception : filtre par état et type, recherche, tiroir de détail avec
  `tel:`/`mailto:`, réponse, état, notes internes).
- Composants communs (`Tiroir`, `OngletsLangues`…) : réutiliser ceux de `src/composants/` (vague 1).
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js` ; aucun prix inventé.
