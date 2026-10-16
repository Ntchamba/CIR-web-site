# Vague 1 : contrat d'API (catalogue, vitrine, actualites, contenus)

Rédigé par le coordinateur le 16 octobre 2026. Les agents `backend`, `site` et `tableau-de-bord` travaillent en
parallèle à partir de ce contrat : le back-end l'implémente, les front-ends le consomment (en tests, l'API est
simulée). Tout écart nécessaire est signalé dans le rapport de l'agent, jamais improvisé en silence.

## Règles communes

- **Multilingue** (CLAUDE.md, « Multilingue ») : chaque modèle dont le texte s'affiche sur le site utilise
  `TraductionsMixin` + `traductions = champ_traductions()` (`apps/noyau/traductions.py`).
  - API publique (`SerialiseurTraduitMixin`) : chaque champ traduit arrive **déjà dans la langue** de
    l'en-tête `Accept-Language` (français en secours) ; pas de champ `traductions`.
  - API équipe (`SerialiseurTraductionsAdminMixin`) : champs français + `traductions`
    (`{"en": {"nom": "…"}, "zh": {…}, "de": {…}, "ja": {…}}`, langues et champs contrôlés) +
    `langues_incompletes` (lecture seule, ex. `["de", "ja"]`).
  - Les objets imbriqués (caractéristiques, couches, designs, images) suivent la même règle.
- **Images** : `ImagesOptimiseesMixin` (WebP). Une `ImageInvalide` devient une erreur 400 sur le champ
  (`{"image": ["…"]}`). Les URL de médias sont **absolues** (`request.build_absolute_uri`), car le site et le
  tableau de bord sont sur d'autres domaines. Objet image : `{"url": "https://…/media/…webp", "alt": "…"}`.
- **Vidéos** : `.mp4` ou `.webm`, 50 Mo au plus (vidéo de fond de l'accueil : 30 Mo), sinon 400.
- **Listes publiques paginées** : `{count, next, previous, results}` (24 par page, `?taille=` jusqu'à 100,
  `?page=`). Les petites listes (familles, bandeaux, sphère) sont des tableaux simples.
- **Accès** : API publique en lecture `AllowAny` (seuls les éléments publiés / en ligne) ; API équipe
  `EstEquipe` (`apps.noyau.permissions`). Écritures en JSON, ou en `multipart/form-data` quand il y a un
  fichier (dans ce cas `traductions`, `caracteristiques`, `couches`, `produits` sont des **chaînes JSON**).
- **Prix** (BF-05) : facultatif, entier en FCFA, renvoyé en chaîne (`"12500"`) ou `null` ; `unite_prix` ∈
  `m2`, `kg`, `pose`. Côté front : `prix(valeur, unite)` de `@partage/utils/format.js` (« Prix sur devis »).
  **Aucun prix, témoignage, nom de client ou chantier inventé**, ni dans le code ni dans les données de démo.
- **Usages / type de chantier** : `maison`, `industrie`, `entreprise`, `exterieur` (libellés traduits côté front).
- **Médias en production** : ajouter le service des fichiers `/media/` par Django quand
  `DJANGO_SERVIR_MEDIAS` vaut vrai (vrai par défaut en production : volume Railway), avec un en-tête de cache.

## Module `catalogue` (BF-01, BF-05, BF-06, BF-14)

### Modèles

| Modèle | Champs | Traduits |
|---|---|---|
| `Famille` | `nom` (unique), `slug` (auto, unique), `description`, `ordre` | `nom`, `description` |
| `Produit` | `famille` (FK, PROTECT), `reference` (ex. « YD-500 », facultative), `nom`, `slug` (auto, unique), `accroche` (≤ 200), `description`, `domaine_application`, `performances`, `preparation`, `methode_application`, `dosage`, `conditions_chantier`, `pour_maison`, `pour_industrie`, `pour_entreprise`, `pour_exterieur` (booléens), `prix` (entier ≥ 0, null), `unite_prix`, `en_ligne` (défaut vrai), `a_la_une`, `est_nouveau`, `ordre`, `cree_le`, `modifie_le` | `nom`, `accroche`, `description`, `domaine_application`, `performances`, `preparation`, `methode_application`, `dosage`, `conditions_chantier` |
| `ImageProduit` | `produit`, `image` (WebP 1280), `alt`, `ordre` (la première est la vignette) | `alt` |
| `Design` | `produit`, `nom`, `image` (WebP 960, facultative), `couleur` (`#RRGGBB`, facultative), `ordre` | `nom` |
| `Caracteristique` | `produit`, `libelle`, `valeur`, `ordre` (tableau des indicateurs techniques) | `libelle`, `valeur` |
| `Couche` | `produit`, `nom`, `epaisseur`, `ordre` (0 = surface, puis vers le support : plan de coupe) | `nom` |

Fichiers propres : `filtres.py` (famille, usage, nouveauté, à la une, recherche), `prix.py` (contrôle du prix
et de l'unité).

### API publique `/api/catalogue/`

- `GET familles/` → `[{id, nom, slug, description, nombre_produits}]` (produits en ligne seulement).
- `GET produits/` `?famille=<slug>&usage=maison|industrie|entreprise|exterieur&nouveau=1&a_la_une=1&search=…`
  → paginé, `results: [ProduitCarte]` :
  `{id, slug, reference, nom, accroche, famille: {slug, nom}, usages: ["maison", …], prix, unite_prix,
  image: {url, alt} | null, est_nouveau, a_la_une}`.
- `GET produits/<slug>/` → `ProduitCarte` + `description, domaine_application, performances,
  mise_en_oeuvre: {preparation, methode_application, dosage, conditions_chantier},
  images: [{url, alt}], designs: [{id, nom, image: {url, alt} | null, couleur}],
  caracteristiques: [{libelle, valeur}], couches: [{nom, epaisseur}]`. 404 si hors ligne.

### API équipe `/api/admin/catalogue/`

- `familles/` (GET liste simple, POST, GET/PATCH/DELETE `<id>/`) :
  `{id, nom, slug (lecture), description, ordre, traductions, langues_incompletes, nombre_produits}`.
  DELETE d'une famille qui a des produits → 400 `{"detail": "…"}`.
- `produits/` (GET paginé `?famille=<id>&en_ligne=1|0&search=…`, POST, GET/PATCH/DELETE `<id>/`) :
  tous les champs du modèle (`famille` = id) + `traductions`, `langues_incompletes`,
  `caracteristiques: [{libelle, valeur, traductions}]`, `couches: [{nom, epaisseur, traductions}]`
  (listes **remplacées en entier** à l'écriture, l'ordre suit celui de la liste),
  `images: [{id, url, alt, ordre, traductions}]` et `designs: [{id, nom, image, couleur, ordre, traductions}]`
  (lecture ; écriture par les routes ci-dessous).
- `produits/<id>/images/` POST multipart `image, alt?, traductions?` → image ;
  `images/<id>/` PATCH (`alt, ordre, traductions`) et DELETE.
- `produits/<id>/designs/` POST multipart `nom, image?, couleur?, traductions?` → design ;
  `designs/<id>/` PATCH (multipart) et DELETE.

### Données de référence

Commande `python manage.py charger_catalogue_reference` (idempotente) : les **neuf familles** du cahier des
charges (§ « Familles de produits ») avec leurs traductions, et seulement les produits dont la référence et
l'usage sont clairement liés dans le cahier : YD-500 (sol autolissant), YD-306 (sable coloré), YD-518
(terrazzo époxy), YD-103, YD-104 (primaires), YD-205 (couche intermédiaire), YD-106W, YD-206W, YD-306W
(primaire, intermédiaire et finition sans solvant). Sans prix, sans image, `en_ligne` vrai ; YD-500, YD-306 et
YD-518 `a_la_une` (recommandation du cahier pour l'habitat).

## Module `vitrine` (BF-02, BF-03, BF-04, BF-15)

### Modèles

| Modèle | Champs | Traduits |
|---|---|---|
| `Realisation` | `titre`, `slug`, `type_chantier`, `ville`, `description`, `image_apres` (obligatoire), `image_avant` (facultative), `produits` (M2M catalogue), `publie` (défaut vrai), `date`, `ordre` | `titre`, `description` |
| `Demo` | `titre`, `description`, `video` (fichier) **ou** `lien` (YouTube ou Vimeo, au moins l'un des deux), `miniature` (WebP 960), `duree` (« 1:45 »), `realisation` (FK facultative), `publie`, `ordre` | `titre`, `description` |
| `Temoignage` | `auteur` (FK utilisateur, null), `nom_affiche`, `ville`, `type_chantier`, `texte` (20 à 800 caractères), `note` (1 à 5), `langue` (langue d'écriture, code court), `statut` (`en_attente`, `publie`, `refuse`), `motif_refus`, `cree_le`, `modere_le`, `modere_par` | **non traduit** : les mots du client restent tels quels, avec leur `langue` |

Fichier propre : `moderation.py` (contrôle du texte : longueur, pas de lien ni de numéro de téléphone ;
publication, refus).

### API publique `/api/vitrine/`

- `GET realisations/` `?type=<type_chantier>` → paginé : `{id, slug, titre, type_chantier, ville, description,
  image_avant: {url, alt} | null, image_apres: {url, alt}, date, produits: [{slug, nom}]}` ; `GET realisations/<slug>/`.
- `GET demos/` → paginé : `{id, titre, description, video: url | null, lien: url | null,
  integration: url | null` (adresse d'intégration `youtube-nocookie.com/embed/…` ou `player.vimeo.com/video/…`),
  `miniature: {url, alt} | null, duree}`.
- `GET temoignages/` → paginé, publiés seulement : `{id, nom_affiche, ville, type_chantier, texte, note, langue, date}`.
- `POST temoignages/` (**client connecté**, quota 5 par jour) `{texte, note, ville?, type_chantier?}` →
  201, statut `en_attente` ; `nom_affiche` = nom complet du compte, `langue` = langue de la requête.
- `GET temoignages/miens/` (connecté) → ses témoignages avec `statut` (et `motif_refus` si refusé).

### API équipe `/api/admin/vitrine/`

- `realisations/` CRUD (multipart pour les images ; `produits` = liste d'ids), champs + `traductions`, `langues_incompletes`.
- `demos/` CRUD (multipart), idem.
- `temoignages/` GET paginé `?statut=…`, `POST <id>/publier/`, `POST <id>/refuser/` `{motif?}`, DELETE.
  Réponse : tous les champs + `auteur: {id, email, nom_complet} | null`.

## Module `actualites` (BF-07)

| Modèle | Champs | Traduits |
|---|---|---|
| `Actualite` | `titre`, `slug`, `resume` (≤ 280), `texte`, `image` (facultative), `produit` (FK catalogue, SET_NULL), `publie` (défaut vrai), `publie_le` (date et heure ; dans le futur = programmée) | `titre`, `resume`, `texte` |

- Public `GET /api/actualites/` (publiées et `publie_le` passée, de la plus récente à la plus ancienne ;
  `?taille=3` pour l'accueil) → paginé : `{id, slug, titre, resume, texte, image: {url, alt} | null,
  produit: {slug, nom} | null, publie_le}` ; `GET /api/actualites/<slug>/`.
- Équipe `/api/admin/actualites/` CRUD (multipart), champs + `traductions`, `langues_incompletes`, `programmee` (booléen).

## Module `contenus` (BF-15, O2)

| Modèle | Champs | Traduits |
|---|---|---|
| `ContenuAccueil` (enregistrement unique) | `titre`, `accroche`, `video_fond` (facultative), `image_affiche` (image de la vidéo, facultative), `texte_partenaire`, `telephones` (liste JSON de numéros), `whatsapp`, `email`, `adresse` | `titre`, `accroche`, `texte_partenaire` |
| `Bandeau` | `texte`, `lien` (chemin interne commençant par `/`, facultatif), `actif`, `debut`, `fin` (dates `AAAA-MM-JJ` facultatives, fin incluse : affiché si `debut <= aujourd'hui <= fin`, jour de Douala ; `fin == debut` accepté), `ordre` | `texte` |
| `PhotoSphere` | `image` (WebP 480), `alt`, `produit` (FK catalogue, SET_NULL), `ordre` | `alt` |

- Public `GET /api/contenus/accueil/` → **une seule requête pour l'accueil** :
  `{titre, accroche, video_fond: url | null, image_affiche: {url, alt} | null, texte_partenaire,
  coordonnees: {telephones: ["+237 …"], whatsapp, email, adresse},
  bandeaux: [{id, texte, lien}]` (actifs et dans leurs dates), `sphere: [{id, image: {url, alt}, produit: {slug, nom} | null}]}`.
  Valeurs vides tant que l'équipe n'a rien saisi : le site affiche alors ses propres textes par défaut.
  Coordonnées initiales (migration de données) : les trois numéros de `frontend/site/src/layout/coordonnees.js`,
  WhatsApp `+237 622 191 931`, adresse « Total Nkolmbong, Douala » (cahier des charges).
- Équipe `/api/admin/contenus/` : `accueil/` GET et PATCH (multipart possible) avec `traductions`,
  `langues_incompletes` ; `bandeaux/` CRUD ; `sphere/` CRUD (multipart) et `POST sphere/ordre/ {ids: [...]}`.

## Site public (agent `site`)

- Routes : `/` (accueil), `/catalogue`, `/catalogue/:slug`, `/realisations` (réalisations, démos, témoignages),
  `/actualites`, `/actualites/:slug`. Pages chargées à la demande.
- Accueil : `Hero` (titre, accroche, `VideoFond` jouée une fois, sans son ; image seule si
  `prefers-reduced-motion` ou économie de données), bandeaux, `Sphere` de photos (clic → produit ; grille simple
  si mouvement réduit), produits à la une, `SectionActualites` (3 dernières), aperçu des réalisations,
  partenaire Jiuye. Textes par défaut traduits quand l'API renvoie des champs vides.
- Catalogue : `Filtres` (famille, usage, recherche ; critères dans l'adresse), `CarteProduit`, « Voir plus ».
- Produit : galerie, `PanneauOptions` (designs ; boutons « Appeler » / « WhatsApp » en attendant la sélection et
  la commande de la vague 2), `FicheTechnique` (présentation, performances, mise en œuvre, tableau des
  indicateurs), `PlanCoupe` (schéma des couches, accessible : liste lisible par les lecteurs d'écran).
- Vitrine : `AvantApres` (curseur accessible au clavier), `Demos` (la vidéo ou l'iframe ne se charge qu'au clic),
  `Temoignages` + `FormulaireTemoignage` (client connecté ; sinon lien vers la connexion avec `?suite=`),
  message « en attente de validation » après envoi.
- Pied de page et en-tête : coordonnées venant de `contenus` (repli sur `coordonnees.js`).
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js`.

## Tableau de bord (agent `tableau-de-bord`)

- Menu : `catalogue`, `vitrine`, `actualites`, `contenus` passent de « À venir » à « Pilotage ».
- Composants propres au tableau de bord (dans `src/composants/`, pas dans `frontend/partage/`) :
  `OngletsLangues` (onglet Français obligatoire + un onglet par autre langue, pastille sur les langues
  incomplètes), `ChampImage` (aperçu, envoi, erreur 400 affichée), `Tiroir` (panneau latéral accessible : focus
  piégé, Échap).
- `/catalogue` : liste filtrable des produits (en ligne / hors ligne, famille, recherche), `TiroirProduit`
  (champs, prix et unité, usages, traductions par onglet, images, designs), `EditeurCouches` (plan de coupe :
  ajout, ordre, épaisseur) et éditeur des caractéristiques ; gestion des familles.
- `/vitrine` : sous-pages `RealisationsPage`, `DemosPage`, `TemoignagesPage` (modération : publier, refuser
  avec motif ; filtre par statut ; compteur « en attente »).
- `/actualites` : liste, création, programmation (`publie_le` futur → pastille « Programmée »).
- `/contenus` : `SectionAccueil` (titre, accroche, vidéo, image, coordonnées), bandeaux, `SectionSphere`
  (photos, produit lié, ordre).
- Tous les textes dans `src/i18n/{fr,en,zh,de,ja}.js`.
