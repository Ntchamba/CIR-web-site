// Zoom de la vignette d'un produit vers le grand carré de sa fiche (API View Transitions) : l'image cliquée reçoit le nom
// de transition « produit-image » juste avant la navigation ; la fiche donne le même nom à sa grande image. Au retour
// (précédent, flèche « < »), c'est la vignette du produit quitté qui reçoit le nom, et le trajet s'inverse.
let dernierProduitVu = null;

/** Retient le produit que le visiteur ouvre (ou vient de quitter). */
export const retenirProduitVu = (slug) => { dernierProduitVu = slug; };
export const produitVu = () => dernierProduitVu;

/** À poser sur le clic d'une carte : nomme l'image de la vignette pour le zoom, et retient le produit. */
export function nommerVignette(evenement, slug) {
  retenirProduitVu(slug);
  // Un nom de transition ne peut désigner qu'un seul élément : on l'enlève aux autres vignettes.
  document.querySelectorAll('img').forEach((i) => { if (i.style.viewTransitionName) i.style.viewTransitionName = ''; });
  const image = evenement.currentTarget?.querySelector?.('img');
  if (image) image.style.viewTransitionName = 'produit-image';
}
