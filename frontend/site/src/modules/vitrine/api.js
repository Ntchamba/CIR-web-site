// BF-02, BF-03, BF-04 : réalisations, démonstrations et témoignages (/api/vitrine/).
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** { type, page, taille } → paginé : [{id, slug, titre, type_chantier, ville, description, image_avant, image_apres, date, produits}] */
export const realisations = (criteres = {}, { signal } = {}) =>
  api.get(`/api/vitrine/realisations/${requete(criteres)}`, { auth: false, signal });

/** paginé : [{id, titre, description, video, lien, integration, miniature, duree}] */
export const demos = (criteres = {}, { signal } = {}) =>
  api.get(`/api/vitrine/demos/${requete(criteres)}`, { auth: false, signal });

/** paginé, publiés seulement : [{id, nom_affiche, ville, type_chantier, texte, note, langue, date}] */
export const temoignages = (criteres = {}, { signal } = {}) =>
  api.get(`/api/vitrine/temoignages/${requete(criteres)}`, { auth: false, signal });

/** Client connecté : { texte, note, ville?, type_chantier? } → 201, statut « en_attente ». */
export const envoyerTemoignage = (donnees) => api.post('/api/vitrine/temoignages/', donnees);

/** Client connecté : ses témoignages avec `statut` (et `motif_refus` si refusé). */
export const mesTemoignages = ({ signal } = {}) => api.get('/api/vitrine/temoignages/miens/', { signal });
