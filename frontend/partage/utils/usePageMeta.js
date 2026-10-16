// Titre de l'onglet et description de chaque page, pour les moteurs de recherche (BNF-10).
// Chaque application règle une fois son suffixe : configurerPageMeta({ suffixe: ' | CIR', titreParDefaut: 'CIR' }).
// Suffixe et titre par défaut peuvent être des fonctions (texte traduit, relu à chaque page).
import { useEffect } from 'react';

const reglages = { suffixe: '', titreParDefaut: '' };

export function configurerPageMeta({ suffixe, titreParDefaut } = {}) {
  if (suffixe !== undefined) reglages.suffixe = suffixe;
  if (titreParDefaut !== undefined) reglages.titreParDefaut = titreParDefaut;
}

/** Calcule le titre complet de l'onglet. */
const valeur = (reglage) => (typeof reglage === 'function' ? reglage() : reglage);

export function titreComplet(titre) {
  return titre ? `${titre}${valeur(reglages.suffixe)}` : valeur(reglages.titreParDefaut) || document.title;
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
