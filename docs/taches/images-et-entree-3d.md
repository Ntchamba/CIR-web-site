# Images, maquettes et entrée 3D (hors vagues)

Branche `images` (depuis `prototype-2`). Décisions : `docs/decisions/11-entree-3d.md`. Maquettes : `docs/reference/`.

## Médias fournis par le propriétaire

- **Vidéo** : `backend/medias_reference/video/fond.mp4` et `fond.webm` (10 s, 1280 x 720 : du béton brut au salon avec sol
  en résine marbrée et bidons). Seule chose retenue des archives de maquettes.
- **11 images** (`im.zip`), converties en WebP léger : `backend/medias_reference/images/` (`salon-pose`, `hall-femme`,
  `ecole-terrazzo`, `entrepot-bleu-jaune`, `entrepot-stockage`, `parking-vert`, `hall-turquoise`, `gradins`, `salon-bidons`,
  `hall-marbre`, `atelier-pose`). Les images des maquettes ne sont **pas** à utiliser.
- Tirés de la vidéo : `affiche-1280.webp` et `affiche-768.webp` (première image : béton brut), et dans
  `frontend/site/public/media/accueil/` : `fond-maison-desktop.webp`, `fond-maison-mobile.webp`, `bandeau-maison-1280.webp`,
  `bandeau-maison-800.webp` (dernière image : la maison).

## Règles

- Ces images semblent générées : **aucune « réalisation » n'est créée avec** (une réalisation est un chantier réel, avec
  son nom et sa ville) ; aucun témoignage, aucun nom de client, aucun prix inventés. La femme (`hall-femme`) n'est jamais
  présentée comme une cliente ni un témoignage.
- Produits : aucune image n'est rattachée à une référence sans confirmation du propriétaire.

## Tâches

- [x] Back-end (`backend` + `backend-testeur`) : commande `importer_medias_reference` (voir ci-dessous) ; catalogue fusionné (16 produits) et 6 images de produits. VALIDÉ.
- [x] Site (`site` + `site-testeur`) : design fidèle aux maquettes (pages, textes) et entrée 3D au défilement. VALIDÉ.

### Commande `python manage.py importer_medias_reference`

Charge en base, de façon **idempotente** (relancer ne duplique rien ; `--forcer` remplace) et **sans rien inventer** :
1. `ContenuAccueil` : `video_fond` ← `video/fond.mp4` et `image_affiche` ← `images/affiche-1280.webp` (seulement si vides, sauf `--forcer`).
   Ne touche à aucun texte, titre, téléphone ni coordonnée.
2. `PhotoSphere` : une ligne par image de la sphère (ordre fixe) avec `alt` en français **et** traduit dans les 4 autres
   langues (descriptions factuelles de ce que montre la photo : « Hall d'école au sol en terrazzo », etc. ; aucun nom
   propre inventé), sans produit lié. Les 11 images, sauf `hall-femme` et `hall-marbre` (réservées à une autre section) :
   soit 9 photos. Idempotence par nom de fichier d'origine.
3. Un manifeste `backend/medias_reference/medias.json` décrit chaque fichier (usage, `alt` dans les 5 langues).
4. Passe par les modèles (donc conversion WebP et limites de poids existantes), jamais par un copier de fichiers brut.
5. Aucun appel réseau. Messages en français (`gettext`), traductions `.po` des 4 langues, `compiler_traductions`.
6. Tests : première exécution, seconde exécution sans doublon, `--forcer`, fichier manquant (erreur claire, rien de partiel),
   textes de l'accueil intacts, 9 photos de sphère avec alt dans les 5 langues.

### Site : habillage et entrée 3D

À partir des maquettes (`docs/reference/maquette-desktop/index.html` et `maquette-telephone/index.html`, structure et
disposition uniquement) et de `docs/contexte-projet.md` de la branche `prototype-1` (décisions de design) :
- Ambiance immersive : photo de la maison (`fond-maison-*`) en scène de fond sur toutes les pages, assombrie par l'encre
  `#0E2A38` (pas de fond blanc), contenu sur verre léger lisible (contraste AA).
- **Entrée 3D** selon `docs/decisions/11-entree-3d.md` : accueil (vidéo, sphère, sélection, réalisations, contact) comme une
  suite de salles en profondeur ; vues internes avec blocs arrivant de la profondeur ; zoom avant entre les pages.
  Défilement natif, amélioration progressive, `prefers-reduced-motion`, économie de données, téléphone allégé.
- Bandeaux photo `bandeau-maison-*` passant sous la barre de navigation (catalogue, réalisations, commandes).
- Les textes entre crochets des maquettes restent des emplacements : sans donnée, le site affiche « Prix sur devis » ou
  masque le bloc, jamais une valeur inventée.

## État au 22 octobre 2026

- Tests : back-end 1445 (PostgreSQL 16), site 687, tableau de bord 506.
- Pour charger les médias et le catalogue sur une base neuve : `python manage.py charger_catalogue_reference` puis
  `python manage.py importer_medias_reference` (idempotents). En production : à lancer une fois sur Railway.
- **Écarts connus avec les maquettes** : connexion par e-mail seulement (la maquette dit « Téléphone ou e-mail ») et pas de
  « Mot de passe oublié ? » (aucune route de réinitialisation) ; sections « Témoignages » et cartes de chantier de l'accueil
  absentes faute de données réelles ; 4 produits sans image (sable coloré, mate, anticorrosion, sol à motifs) ; familles et usages
  des 7 produits de la maquette à valider par l'équipe.
