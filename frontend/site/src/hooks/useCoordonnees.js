// Téléphone, WhatsApp et adresse du CIR (modifiables depuis le dashboard).
import { useEffect, useState } from 'react';

import { chargerContenuAccueil, COORDONNEES } from '@/modules/accueil/api.js';

export default function useCoordonnees() {
  const [coordonnees, setCoordonnees] = useState(COORDONNEES);
  useEffect(() => {
    let actif = true;
    chargerContenuAccueil()
      .then((c) => actif && setCoordonnees({ telephone: c.telephone, whatsapp: c.whatsapp, adresse: c.adresse,
        email: c.email, texte_partenaire: c.texte_partenaire }))
      .catch(() => {});
    return () => { actif = false; };
  }, []);
  return coordonnees;
}
