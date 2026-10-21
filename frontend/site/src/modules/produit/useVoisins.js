// Produits voisins dans le catalogue (« ← Préc. » et « Suiv. → » de la fiche) : les produits en ligne dans l'ordre du
// catalogue. La liste (100 au plus, une seule requête par langue) est gardée pour la session.
import { useEffect, useState } from 'react';

import { resultats } from '@partage/api/client.js';

import { langueCourante } from '@/i18n/index.js';
import * as catalogue from '@/modules/catalogue/api.js';

const memoire = new Map(); // langue -> promesse de la liste

export const oublierVoisins = () => memoire.clear();

function liste() {
  const langue = langueCourante();
  if (!memoire.has(langue)) {
    memoire.set(langue, catalogue.produits({ taille: 100 }).then((d) => resultats(d)).catch((erreur) => {
      memoire.delete(langue);
      throw erreur;
    }));
  }
  return memoire.get(langue);
}

/** `{ precedent, suivant }` : produits voisins du produit `slug` (null en bout de liste ou tant que la liste charge). */
export default function useVoisins(slug) {
  const [voisins, setVoisins] = useState({ precedent: null, suivant: null });
  useEffect(() => {
    let actif = true;
    liste()
      .then((produits) => {
        if (!actif) return;
        const i = produits.findIndex((p) => p.slug === slug);
        setVoisins(i < 0 ? { precedent: null, suivant: null } : { precedent: produits[i - 1] ?? null, suivant: produits[i + 1] ?? null });
      })
      .catch(() => actif && setVoisins({ precedent: null, suivant: null }));
    return () => { actif = false; };
  }, [slug]);
  return voisins;
}
