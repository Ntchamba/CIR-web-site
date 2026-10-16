// Catalogue : critères lus dans l'adresse (?famille=&usage=&q=), familles et produits paginés.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import useDonnees from '@/app/useDonnees.js';
import useListePaginee from '@/app/useListePaginee.js';

import * as catalogue from './api.js';
import { estUsage } from './usages.js';

/** Critères de l'adresse, nettoyés (un usage inconnu est ignoré). */
export function lireCriteres(parametres) {
  const usage = parametres.get('usage') || '';
  return {
    famille: parametres.get('famille') || '',
    usage: estUsage(usage) ? usage : '',
    q: (parametres.get('q') || '').trim(),
  };
}

export default function useCatalogue() {
  const [parametres, setParametres] = useSearchParams();
  const criteres = useMemo(() => lireCriteres(parametres), [parametres]);
  const cle = `${criteres.famille}|${criteres.usage}|${criteres.q}`;

  const familles = useDonnees(({ signal }) => catalogue.familles({ signal }), []);
  const produits = useListePaginee(
    ({ page, signal }) => catalogue.produits(
      { famille: criteres.famille, usage: criteres.usage, search: criteres.q, page: page > 1 ? page : '' },
      { signal },
    ),
    [cle],
  );

  /** Change un ou plusieurs critères ; l'adresse garde les autres paramètres (ex. ?lang=). */
  const changerCriteres = useCallback((changements) => {
    setParametres((actuels) => {
      const suivants = new URLSearchParams(actuels);
      Object.entries(changements).forEach(([nom, valeur]) => {
        if (valeur) suivants.set(nom, valeur);
        else suivants.delete(nom);
      });
      return suivants;
    }, { replace: true });
  }, [setParametres]);

  const effacerCriteres = useCallback(() => changerCriteres({ famille: '', usage: '', q: '' }), [changerCriteres]);

  return { criteres, familles, produits, changerCriteres, effacerCriteres };
}
