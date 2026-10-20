// BF-07, BF-13 : notifications du client connecté (/api/notifications/).
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** Paginé, `?lue=0|1` : [{id, type, titre, texte, lien, lue, cree_le}] (texte produit par le serveur dans la langue de la requête). */
export const lister = (criteres = {}, { signal } = {}) => api.get(`/api/notifications/${requete(criteres)}`, { signal });

/** → {count} */
export const nonLues = ({ signal } = {}) => api.get('/api/notifications/non-lues/', { signal });

export const marquerLue = (id) => api.post(`/api/notifications/${id}/lue/`, {});

/** Tout marquer comme lu → {count: 0} */
export const toutMarquerLu = () => api.post('/api/notifications/lues/', {});

/** → {recevoir_nouveautes: bool} (consentement : désactivé par défaut) */
export const preferences = ({ signal } = {}) => api.get('/api/notifications/preferences/', { signal });

export const modifierPreferences = (corps) => api.patch('/api/notifications/preferences/', corps);
