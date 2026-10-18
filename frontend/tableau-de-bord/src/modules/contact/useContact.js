// État de la page Demandes de contact : boîte de réception filtrée (critères dans l'adresse) et décomptes par état.
import useChargement from '@/composants/useChargement.js';
import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';

import { listerDemandes, resumeDemandes } from './api.js';

export const ETATS = ['nouvelle', 'en_cours', 'traitee'];
export const TYPES = ['question', 'rappel'];

export default function useContact() {
  const { valeurs, page, modifier } = useCriteres(['etat', 'type', 'q']);
  const liste = useListe(listerDemandes, { etat: valeurs.etat, type: valeurs.type, recherche: valeurs.q, page });
  const resume = useChargement((signal) => resumeDemandes({ signal }), []);
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  return {
    ...liste,
    page,
    etat: valeurs.etat,
    type: valeurs.type,
    resume: resume.donnees || {},
    rechargerResume: resume.recharger,
    saisie,
    changerSaisie,
    choisirEtat: (etat) => modifier({ etat }),
    choisirType: (type) => modifier({ type }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => { effacerSaisie(); modifier({ q: '', type: '', etat: '' }); },
    filtre: Boolean(valeurs.q || valeurs.type || valeurs.etat),
  };
}
