// BF-07 : actualités côté équipe (/api/admin/actualites/), voir docs/taches/vague-1-contrat-api.md.
import { api, resultats } from '@/app/api.js';
import { envoyer } from '@/composants/envoi.js';

const BASE = '/api/admin/actualites/';
export const TAILLE_LISTE = 100;

/** → { elements: [{ id, titre, resume, texte, image, produit, publie, publie_le, programmee, traductions, langues_incompletes }], total } */
export const listerActualites = ({ signal } = {}) => api.get(`${BASE}?taille=${TAILLE_LISTE}`, { signal })
  .then((d) => ({ elements: resultats(d), total: typeof d?.count === 'number' ? d.count : resultats(d).length }));

/** `fichiers` : { image: File | null | undefined } (multipart s'il y a un fichier). */
export const creerActualite = (donnees, fichiers) => envoyer(BASE, donnees, { fichiers });
export const modifierActualite = (id, donnees, fichiers) => envoyer(`${BASE}${id}/`, donnees, { methode: 'PATCH', fichiers });
export const supprimerActualite = (id) => api.supprimer(`${BASE}${id}/`);
