// BF-01, BF-05, BF-14 : catalogue public (/api/catalogue/). Textes déjà dans la langue de l'interface.
import { api } from '@/app/api.js';

/** Chaîne de requête sans les critères vides : { famille: 'sols', usage: '' } → « ?famille=sols ». */
export function requete(criteres = {}) {
  const parametres = new URLSearchParams();
  Object.entries(criteres).forEach(([cle, valeur]) => {
    if (valeur !== undefined && valeur !== null && valeur !== '' && valeur !== false) parametres.set(cle, String(valeur));
  });
  const texte = parametres.toString();
  return texte ? `?${texte}` : '';
}

/** [{id, nom, slug, description, nombre_produits}] (produits en ligne seulement). */
export const familles = ({ signal } = {}) => api.get('/api/catalogue/familles/', { auth: false, signal });

/**
 * Page de produits : { famille, usage, nouveau, a_la_une, search, page, taille } →
 * { count, next, previous, results: [ProduitCarte] }.
 */
export const produits = (criteres = {}, { signal } = {}) =>
  api.get(`/api/catalogue/produits/${requete(criteres)}`, { auth: false, signal });
