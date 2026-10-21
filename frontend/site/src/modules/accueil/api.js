// BF-15, O2 : données de l'accueil. Les contenus (titre, accroche, vidéo, bandeaux, sphère, coordonnées)
// arrivent en une seule requête, partagée avec l'en-tête et le pied de page (layout/contenus.js).
import { produits } from '@/modules/catalogue/api.js';
import { realisations } from '@/modules/vitrine/api.js';

export { chargerContenusAccueil, CHEMIN_CONTENUS_ACCUEIL } from '@/layout/contenus.js';

export const TAILLE_A_LA_UNE = 4;
export const TAILLE_REALISATIONS = 3;

/** Produits « à la une » (accueil). */
export const produitsALaUne = ({ signal } = {}) => produits({ a_la_une: 1, taille: TAILLE_A_LA_UNE }, { signal });

/** Dernières réalisations publiées (aperçu sur l'accueil). */
export const dernieresRealisations = ({ signal } = {}) => realisations({ taille: TAILLE_REALISATIONS }, { signal });
