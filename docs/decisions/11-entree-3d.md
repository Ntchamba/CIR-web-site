# Décision 11 : entrer dans le site (profondeur 3D au défilement)

Date : 21 octobre 2026. Statut : retenue (direction donnée par le propriétaire). Complète `docs/reference/README.md`.

## Demande

Le site doit donner l'impression d'**entrer** dedans. Le défilement ne doit pas dérouler la page de bas en haut
comme une page classique : il fait **entrer en profondeur (3D) dans toutes les vues**. Le fond blanc des maquettes
n'est pas retenu : l'ambiance est immersive (photo de la maison tirée de la vidéo, encre `#0E2A38`, verre léger).

## Choix

- **Axe de profondeur** : chaque section est une « salle » à une profondeur différente. En défilant, la caméra avance :
  la salle courante grandit et passe devant le visiteur (échelle, léger flou, fondu) pendant que la suivante vient du
  fond (`translateZ`, échelle, fondu). Les vues internes (catalogue, réalisations, fiche produit, commandes, compte…)
  utilisent le même vocabulaire : leurs blocs arrivent de la profondeur, et le changement de page est un « zoom
  avant » (API View Transitions quand elle existe).
- **Le défilement reste natif.** Aucun détournement de la molette ni du tactile : barre de défilement, clavier
  (espace, PageBas, Fin), ancres, recherche dans la page, bouton précédent et lecteurs d'écran fonctionnent comme
  partout. La profondeur est liée à la position de défilement par du **CSS pur** (`animation-timeline`) avec
  `perspective` ; pas de bibliothèque 3D, pas de WebGL.
- **Amélioration progressive** : sans prise en charge des animations liées au défilement, avec `prefers-reduced-motion`,
  en mode économie de données ou sur un appareil faible, la page est une page normale, sans transformation
  (le contenu est toujours entier, lisible et dans l'ordre du DOM).
- **Performance** (objectif 300 à 500 ms de chargement) : seulement `transform` et `opacity` (GPU), aucun recalcul de mise
  en page au défilement, aucun JavaScript par image de défilement, profondeur réduite sur téléphone, pas de décalage de
  mise en page (CLS nul), la vidéo reste chargée à la demande selon les règles existantes.
- **Accessibilité** : le contenu animé n'est jamais caché aux lecteurs d'écran ; l'élément qui reçoit le focus est
  ramené à plat (jamais flou ni hors champ) ; contrastes respectés pendant le mouvement ; cibles ≥ 44 px.

## Conséquences

- Le travail se fait dans `frontend/site/` (CSS Modules et un petit composant de scène), sans toucher à l'API.
- Les tests en jsdom ne peuvent pas juger l'animation : ils vérifient le basculement (animations actives ou non selon les
  préférences) et l'absence de régression ; l'animation elle-même est vérifiée dans un vrai navigateur (captures à plusieurs
  positions de défilement).
- Aucun contenu n'est inventé pour cette direction : les images viennent de `im.zip` (fournies) et de la vidéo.
