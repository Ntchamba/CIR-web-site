// État des pages Clients : liste filtrée (critères gardés dans l'adresse de la page) et fiche d'un client.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { resultats } from '@/app/api.js';

import { listerClients, obtenirClient } from './api.js';

export const TAILLE_PAGE = 24; // pagination standard du back-end
const DELAI_RECHERCHE = 300; // ms : on attend la fin de la frappe avant d'interroger le serveur

/** Liste des clients. Les critères (q, ville, page) sont lus et écrits dans l'adresse de la page. */
export default function useClients() {
  const [parametres, setParametres] = useSearchParams();
  const recherche = parametres.get('q') ?? '';
  const ville = parametres.get('ville') ?? '';
  const page = Math.max(1, Number.parseInt(parametres.get('page') ?? '1', 10) || 1);

  // Saisie en cours, envoyée au serveur après un court délai.
  const [saisie, setSaisie] = useState({ recherche, ville });
  const [donnees, setDonnees] = useState({ clients: [], total: 0, suivante: false, precedente: false });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [essai, setEssai] = useState(0);

  const modifierCriteres = useCallback((changements) => {
    setParametres((actuels) => {
      const nouveaux = new URLSearchParams(actuels);
      Object.entries(changements).forEach(([cle, valeur]) => {
        if (valeur === '' || valeur == null || (cle === 'page' && Number(valeur) <= 1)) nouveaux.delete(cle);
        else nouveaux.set(cle, String(valeur));
      });
      return nouveaux;
    }, { replace: true });
  }, [setParametres]);

  // Saisie → adresse de la page (et retour à la première page).
  useEffect(() => {
    const q = saisie.recherche.trim();
    const v = saisie.ville.trim();
    if (q === recherche && v === ville) return undefined;
    const minuteur = setTimeout(() => modifierCriteres({ q, ville: v, page: 1 }), DELAI_RECHERCHE);
    return () => clearTimeout(minuteur);
  }, [saisie, recherche, ville, modifierCriteres]);

  // Adresse de la page → requête au serveur.
  useEffect(() => {
    const controleur = new AbortController();
    setChargement(true);
    setErreur(null);
    listerClients({ recherche, ville, page }, { signal: controleur.signal })
      .then((reponse) => {
        const clients = resultats(reponse);
        setDonnees({
          clients,
          total: typeof reponse?.count === 'number' ? reponse.count : clients.length,
          suivante: Boolean(reponse?.next),
          precedente: Boolean(reponse?.previous),
        });
        setChargement(false);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErreur(e);
        setChargement(false);
      });
    return () => controleur.abort();
  }, [recherche, ville, page, essai]);

  return {
    ...donnees,
    saisie,
    changerSaisie: (champ, valeur) => setSaisie((s) => ({ ...s, [champ]: valeur })),
    effacer: () => { setSaisie({ recherche: '', ville: '' }); modifierCriteres({ q: '', ville: '', page: 1 }); },
    filtre: Boolean(recherche || ville),
    page,
    allerALaPage: (n) => modifierCriteres({ page: n }),
    chargement,
    erreur,
    recharger: () => setEssai((n) => n + 1),
  };
}

/** Fiche d'un client, en lecture. */
export function useFicheClient(id) {
  const [client, setClient] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    const controleur = new AbortController();
    setChargement(true);
    setErreur(null);
    obtenirClient(id, { signal: controleur.signal })
      .then((c) => { setClient(c); setChargement(false); })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErreur(e);
        setChargement(false);
      });
    return () => controleur.abort();
  }, [id, essai]);

  return { client, chargement, erreur, recharger: () => setEssai((n) => n + 1) };
}
