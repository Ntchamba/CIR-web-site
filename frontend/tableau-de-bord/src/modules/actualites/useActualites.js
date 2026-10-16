// État de la page Actualités : liste (de la plus récente à la plus ancienne), mise à jour sur place.
import useChargement from '@/composants/useChargement.js';

import { listerActualites } from './api.js';

const parDate = (a, b) => String(b.publie_le || '').localeCompare(String(a.publie_le || ''));

/** État d'une actualité : 'brouillon' (non publiée), 'programmee' (date future) ou 'publiee'. */
export function etatActualite(actualite, maintenant = Date.now()) {
  if (!actualite?.publie) return 'brouillon';
  const date = actualite.publie_le ? new Date(actualite.publie_le).getTime() : Number.NaN;
  if (actualite.programmee || (!Number.isNaN(date) && date > maintenant)) return 'programmee';
  return 'publiee';
}

export default function useActualites() {
  const etat = useChargement((signal) => listerActualites({ signal }), [], { initial: { elements: [], total: 0 } });
  const { elements = [], total = 0 } = etat.donnees || {};
  const remplacer = (actualite) => etat.setDonnees((d) => {
    const liste = d?.elements || [];
    const existe = liste.some((a) => a.id === actualite.id);
    return {
      elements: existe ? liste.map((a) => (a.id === actualite.id ? actualite : a)) : [actualite, ...liste],
      total: existe ? d.total : (d?.total || 0) + 1,
    };
  });
  const retirer = (id) => etat.setDonnees((d) => ({
    elements: (d?.elements || []).filter((a) => a.id !== id), total: Math.max(0, (d?.total || 0) - 1),
  }));
  return { ...etat, actualites: [...elements].sort(parDate), total, remplacer, retirer };
}
