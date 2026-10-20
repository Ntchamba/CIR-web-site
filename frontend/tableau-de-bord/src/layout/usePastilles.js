// Pastilles du menu : nombre d'éléments à traiter par module, rechargé à chaque changement de page.
//   commandes : commandes qui demandent une action de l'équipe (`action_requise`)
//   devis     : nouvelles demandes de rendu (`nouvelle`)
//   contact   : nouvelles demandes de contact (`nouvelle`)
//   paiements : anomalies + paiements en attente (`paiements/resume/`), relus à chaque trame `paiement_mis_a_jour`
//   messagerie, appels, notifications : compteurs en direct (WebSocket, relus en HTTP si besoin), voir FondDirect.jsx
// Une erreur de chargement n'affiche simplement pas de pastille.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { api } from '@/app/api.js';

import { useDirect } from './direct.js';

const SOURCES = {
  commandes: { chemin: '/api/admin/commandes/resume/', champ: 'action_requise' },
  devis: { chemin: '/api/admin/devis/demandes-rendu/resume/', champ: 'nouvelle' },
  contact: { chemin: '/api/admin/contact/demandes/resume/', champ: 'nouvelle' },
  paiements: { chemin: '/api/admin/paiements/resume/', champ: ['anomalies', 'en_attente'] },
};
const compter = (resume, champ) => [].concat(champ).reduce((somme, c) => somme + (Number(resume?.[c]) || 0), 0);

export default function usePastilles() {
  const { pathname } = useLocation();
  const [nombres, setNombres] = useState({});
  const { compteurs, appelsQuiSonnent, abonner } = useDirect();

  useEffect(() => {
    const controleur = new AbortController();
    Object.entries(SOURCES).forEach(([module, { chemin, champ }]) => {
      api.get(chemin, { signal: controleur.signal })
        .then((resume) => setNombres((n) => ({ ...n, [module]: compter(resume, champ) })))
        .catch(() => {});
    });
    return () => controleur.abort();
  }, [pathname]);

  // Un paiement change d'état en direct : la pastille se recale.
  useEffect(() => abonner((trame) => {
    if (trame?.type !== 'paiement_mis_a_jour') return;
    const { chemin, champ } = SOURCES.paiements;
    api.get(chemin)
      .then((resume) => setNombres((n) => ({ ...n, paiements: compter(resume, champ) })))
      .catch(() => {});
  }), [abonner]);

  return {
    ...nombres,
    messagerie: compteurs.messagerie,
    appels: appelsQuiSonnent.length + compteurs.appelsManques,
    notifications: compteurs.notifications,
  };
}
