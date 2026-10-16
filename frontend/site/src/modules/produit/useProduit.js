// Fiche produit : chargée à chaque changement de produit ou de langue.
import useDonnees from '@/app/useDonnees.js';

import * as api from './api.js';

export default function useProduit(slug) {
  const { donnees, chargement, erreur, recharger } = useDonnees(({ signal }) => api.produit(slug, { signal }), [slug]);
  return { produit: donnees, chargement, erreur, introuvable: erreur?.statut === 404, recharger };
}
