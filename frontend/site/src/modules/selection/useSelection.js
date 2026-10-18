// Page « Ma sélection » : éléments du serveur (rechargés au changement de langue), retrait et vidage.
import { useCallback, useState } from 'react';

import useDonnees from '@/app/useDonnees.js';

import * as selection from './api.js';
import { useSelection as useContexte } from './SelectionContext.jsx';

export default function useSelectionPage() {
  const contexte = useContexte();
  const liste = useDonnees(({ signal }) => selection.lister({ signal }), []);
  const [action, setAction] = useState({ envoi: false, erreur: null, message: '' });
  const { recharger } = liste;

  const retirer = useCallback(async (element) => {
    setAction({ envoi: true, erreur: null, message: '' });
    try {
      await contexte.retirer(element.id);
      setAction({ envoi: false, erreur: null, message: element.produit?.nom || '' });
      recharger();
    } catch (erreur) {
      setAction({ envoi: false, erreur, message: '' });
    }
  }, [contexte, recharger]);

  const vider = useCallback(async () => {
    setAction({ envoi: true, erreur: null, message: '' });
    try {
      await contexte.vider();
      setAction({ envoi: false, erreur: null, message: '*' });
      recharger();
    } catch (erreur) {
      setAction({ envoi: false, erreur, message: '' });
    }
  }, [contexte, recharger]);

  return { liste, action, retirer, vider };
}
