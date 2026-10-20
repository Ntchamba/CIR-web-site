// Pastilles du menu : nombre d'éléments à traiter par module, rechargé à chaque changement de page.
//   commandes : commandes qui demandent une action de l'équipe (`action_requise`)
//   devis     : nouvelles demandes de rendu (`nouvelle`)
//   contact   : nouvelles demandes de contact (`nouvelle`)
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
};

export default function usePastilles() {
  const { pathname } = useLocation();
  const [nombres, setNombres] = useState({});
  const { compteurs, appelsQuiSonnent } = useDirect();

  useEffect(() => {
    const controleur = new AbortController();
    Object.entries(SOURCES).forEach(([module, { chemin, champ }]) => {
      api.get(chemin, { signal: controleur.signal })
        .then((resume) => setNombres((n) => ({ ...n, [module]: Number(resume?.[champ]) || 0 })))
        .catch(() => {});
    });
    return () => controleur.abort();
  }, [pathname]);

  return {
    ...nombres,
    messagerie: compteurs.messagerie,
    appels: appelsQuiSonnent.length + compteurs.appelsManques,
    notifications: compteurs.notifications,
  };
}
