// Titre de l'onglet et description de chaque page, pour les moteurs de recherche (BNF-10).
// Chaque application règle une fois son suffixe : configurerPageMeta({ suffixe: ' | CIR', titreParDefaut: 'CIR' }).
import { useEffect } from 'react';

const reglages = { suffixe: '', titreParDefaut: '' };

export function configurerPageMeta({ suffixe, titreParDefaut } = {}) {
  if (suffixe !== undefined) reglages.suffixe = suffixe;
  if (titreParDefaut !== undefined) reglages.titreParDefaut = titreParDefaut;
}

/** Calcule le titre complet de l'onglet. */
export function titreComplet(titre) {
  return titre ? `${titre}${reglages.suffixe}` : reglages.titreParDefaut || document.title;
}

export default function usePageMeta(titre, description) {
  useEffect(() => {
    document.title = titreComplet(titre);
    if (description) {
      let balise = document.querySelector('meta[name="description"]');
      if (!balise) {
        balise = document.createElement('meta');
        balise.setAttribute('name', 'description');
        document.head.appendChild(balise);
      }
      balise.setAttribute('content', description);
    }
  }, [titre, description]);
}
