// BF-10, BF-12, BF-13 : commandes du client.
import { api, resultats } from '@/lib/api.js';

export const liste = (signal) => api.get('/commandes/?taille=100', { signal }).then(resultats);
export const detail = (numero, signal) => api.get(`/commandes/${numero}/`, { signal });
export const creer = (donnees) => api.post('/commandes/', donnees);
export const contreProposition = (numero, donnees) => api.post(`/commandes/${numero}/propositions/`, donnees);
export const repondre = (numero, id, accepter) =>
  api.post(`/commandes/${numero}/propositions/${id}/${accepter ? 'accepter' : 'refuser'}/`);
