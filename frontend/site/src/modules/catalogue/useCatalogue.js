// Catalogue : critères lus dans l'adresse (?famille=&usage=&q=&page=), familles et une page de produits (pagination
// numérotée de la maquette : 1, 2, 3, « Suivant → »).
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { resultats } from '@partage/api/client.js';

import useDonnees from '@/app/useDonnees.js';

import * as catalogue from './api.js';
import { estUsage } from './usages.js';

export const TAILLE_PAGE = 10; // 3 colonnes de grandes images carrées

/** Critères de l'adresse, nettoyés (un usage inconnu est ignoré, une page invalide vaut 1). */
export function lireCriteres(parametres) {
  const usage = parametres.get('usage') || '';
  const page = Number.parseInt(parametres.get('page') || '1', 10);
  return {
    famille: parametres.get('famille') || '',
    usage: estUsage(usage) ? usage : '',
    q: (parametres.get('q') || '').trim(),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export default function useCatalogue() {
  const [parametres, setParametres] = useSearchParams();
  const criteres = useMemo(() => lireCriteres(parametres), [parametres]);
  const cle = `${criteres.famille}|${criteres.usage}|${criteres.q}|${criteres.page}`;

  const familles = useDonnees(({ signal }) => catalogue.familles({ signal }), []);
  const reponse = useDonnees(
    ({ signal }) => catalogue.produits(
      { famille: criteres.famille, usage: criteres.usage, search: criteres.q, page: criteres.page > 1 ? criteres.page : '', taille: TAILLE_PAGE },
      { signal },
    ),
    [cle],
  );
  const total = reponse.donnees?.count ?? 0;
  const produits = {
    elements: resultats(reponse.donnees),
    total,
    pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
    page: criteres.page,
    chargement: reponse.chargement,
    erreur: reponse.erreur,
    recharger: reponse.recharger,
  };

  /** Change un ou plusieurs critères ; l'adresse garde les autres paramètres (ex. ?lang=). Hors `page`, on revient page 1. */
  const changerCriteres = useCallback((changements, options = {}) => {
    setParametres((actuels) => {
      const suivants = new URLSearchParams(actuels);
      if (!('page' in changements)) suivants.delete('page');
      Object.entries(changements).forEach(([nom, valeur]) => {
        if (valeur && !(nom === 'page' && Number(valeur) <= 1)) suivants.set(nom, valeur);
        else suivants.delete(nom);
      });
      return suivants;
    }, { replace: true, ...options });
  }, [setParametres]);

  const effacerCriteres = useCallback(() => changerCriteres({ famille: '', usage: '', q: '' }), [changerCriteres]);

  return { criteres, familles, produits, changerCriteres, effacerCriteres };
}
