# Fidélité aux maquettes (correction du 21 octobre 2026)

**Règle** : le design des maquettes `maquette-desktop` et `maquette-telephone` est la référence, pour la **mise en page,
les textes et le style**. La 3D ne fait **qu'ajouter du mouvement** à ce design ; elle ne le remplace pas. Une première
version avait transformé le design (panneaux sombres, verre, bandeaux recadrés) : elle est à reprendre.

## Textes

- Reprendre **mot pour mot** les textes français des maquettes (`index.html` et `assets/site.js` des deux dossiers) dans
  `src/i18n/fr.js`, puis les 4 autres langues. Exemple : « Catalogue » / « Des sols durables, des sols uniques. » ;
  « Pour quel sol ? » ; « Famille » ; « Rechercher… » ; « Commander ou personnaliser + » ; « Sélectionner ce produit » ;
  « Préc. » / « Suiv. » ; pied de page (« Entreprise partenaire », « Jiuye, fabricant de résine époxy »,
  « Distributeur Jiuye en Afrique centrale. »…).
- Les crochets (`[PRIX] FCFA / m²`, `[Nom du chantier]`, `[Ville]`…) sont des **emplacements** : sans donnée réelle, afficher
  « Prix sur devis » ou masquer le bloc ; jamais une valeur inventée.

## Pages (à reproduire fidèlement, ordinateur et téléphone)

- **Catalogue** : grand bandeau photo du salon (escaliers, grandes fenêtres) sous l'en-tête transparent à liens blancs ; titre
  « Catalogue » en italique blanc (Lora) centré et sous-titre ; en dessous, fond clair et aéré (le salon visible à travers un voile
  blanc flouté) ; colonne de filtres à gauche (champ de recherche arrondi, liste « POUR QUEL SOL ? » : Tous les sols, Maison,
  Industrie, Entreprise, Extérieur, avec un point corail devant le choix actif ; liste « FAMILLE » : Toutes les familles, puis les
  familles réelles) ; grille de 3 colonnes de **grandes images carrées** sans cadre, nom du produit centré en Lora, prix en dessous ;
  pagination (pastilles 1, 2, 3 et « Suivant → ») ; pied de page sombre (logo, coordonnées, navigation, partenaire).
- **Fiche produit** : plein écran. **Arrière-plan = l'image du produit elle-même, agrandie et floutée, teintée sombre**
  (dégradé encre/vert d'eau). En-tête transparent à liens blancs. À gauche : « ← Catalogue », surtitre mono en capitales
  (« FINITIONS · PRODUIT DU MOMENT »), titre Lora blanc très grand, ligne mono « Réf. YD-500 · brillant, effet miroir, sans
  joints », prix en Lora, description, bouton contour « COMMANDER OU PERSONNALISER + » (ouvre le panneau d'options à droite),
  bouton blanc arrondi « ♡ SÉLECTIONNER CE PRODUIT ». À droite : **le produit au premier plan, dans une grande image carrée**, avec
  « ← PRÉC. » et « SUIV. → » dessous. Le panneau « Commander ou personnaliser » reprend les actions de la maquette.
- **Accueil, réalisations, connexion / créer un compte, mes commandes** : identiques aux maquettes (sections, ordre, textes,
  composants). Écran de connexion partagé comme dans la maquette ; commandes en liste + détail comme dans la maquette.
- Navigation mobile : barre d'onglets du bas comme la maquette téléphone (la messagerie, fonction existante, reste accessible
  depuis l'en-tête ou le compte si les 5 onglets de la maquette sont imposés) ; flèche « < » de retour sur téléphone.

## Adaptation 3D (ce qui s'ajoute)

- **Clic sur un produit** : l'image de la vignette **grandit depuis sa place dans la grille** jusqu'au grand carré du premier plan
  (élément partagé avec l'API View Transitions, `view-transition-name` sur l'image), pendant que l'arrière-plan flouté du produit
  apparaît en zoom arrière-vers-avant (opacité + échelle d'une couche déjà floutée : on n'anime jamais `filter`). « Préc. » / « Suiv. »
  : même effet entre deux produits. Retour au catalogue : trajet inverse.
- **Scène du salon persistante** : sert de fond aux pages qui, dans la maquette, montrent le salon (bandeaux, voile flouté des pages
  claires) ; la caméra se déplace d'une page à l'autre (déjà en place). L'accueil garde le zoom lié au défilement vers la lumière des
  fenêtres, puis le contenu de la maquette.
- Toujours : défilement natif, amélioration progressive, `prefers-reduced-motion`, transform/opacity seulement, accessibilité.

## Images

Les images des maquettes ne sont **pas** utilisées. Les produits montrent l'image du produit en base (voir `docs/taches/images-et-entree-3d.md`) ;
sans image, un carré neutre portant la référence du produit.
