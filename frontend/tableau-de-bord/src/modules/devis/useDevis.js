// État des pages Devis : liste des devis, boîte des demandes de rendu, aperçu du calcul de l'éditeur.
import { useEffect, useMemo, useRef, useState } from 'react';

import useChargement from '@/composants/useChargement.js';
import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';

import {
  calculerDevis, listerDemandesRendu, listerDevis, obtenirCommandeDuDevis, obtenirDevis, resumeDemandesRendu,
} from './api.js';
import { erreursApercu, erreursLignes, versCorps } from './lignes.js';

export const ONGLETS_DEVIS = ['devis', 'demandes'];
export const DELAI_APERCU = 400; // ms : on attend la fin de la saisie avant d'interroger le serveur

/** Page /devis : onglet, filtres et listes (critères gardés dans l'adresse). */
export default function useDevis() {
  const { valeurs, page, modifier } = useCriteres(['onglet', 'etat', 'q', 'commande']);
  const onglet = ONGLETS_DEVIS.includes(valeurs.onglet) ? valeurs.onglet : 'devis';
  const criteres = { etat: valeurs.etat, recherche: valeurs.q, commande: valeurs.commande, page };
  const devis = useListe((c, o) => (onglet === 'devis' ? listerDevis(c, o) : Promise.resolve({ results: [], count: 0 })), { ...criteres, onglet });
  const demandes = useListe((c, o) => (onglet === 'demandes' ? listerDemandesRendu(c, o) : Promise.resolve({ results: [], count: 0 })), { ...criteres, onglet });
  const resume = useChargement((signal) => resumeDemandesRendu({ signal }), []);
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  return {
    onglet,
    liste: onglet === 'devis' ? devis : demandes,
    resume: resume.donnees || {},
    rechargerResume: resume.recharger,
    page,
    etat: valeurs.etat,
    commande: valeurs.commande,
    saisie,
    changerSaisie,
    choisirOnglet: (cle) => { effacerSaisie(); modifier({ onglet: cle === 'devis' ? '' : cle, etat: '', q: '', commande: '' }); },
    choisirEtat: (etat) => modifier({ etat }),
    allerALaPage: (n) => modifier({ page: n }),
    effacer: () => { effacerSaisie(); modifier({ q: '', etat: '', commande: '' }); },
    filtre: Boolean(valeurs.q || valeurs.etat || valeurs.commande),
  };
}

/** Devis existant et sa commande (référence, client, lignes…). */
export function useDevisEtCommande({ id, commandeId }) {
  const devis = useChargement((signal) => (id ? obtenirDevis(id, { signal }) : null), [id]);
  const numero = id
    ? (typeof devis.donnees?.commande === 'object' ? devis.donnees.commande?.id : devis.donnees?.commande)
    : commandeId;
  const commande = useChargement((signal) => (numero ? obtenirCommandeDuDevis(numero, { signal }) : null), [numero]);
  return { devis, commande, commandeId: numero };
}

/**
 * Aperçu du calcul : après `delai` ms sans modification des lignes, le serveur calcule (`calculer/`).
 * Renvoie { apercu, erreursParLigne, erreurGenerale, calcul } ; `calcul` est vrai pendant le calcul.
 */
export function useApercu(lignes, { actif = true, delai = DELAI_APERCU } = {}) {
  const [etat, setEtat] = useState({ apercu: null, erreur: null });
  const [calcul, setCalcul] = useState(false);
  const corps = useMemo(() => lignes.map(versCorps), [lignes]);
  const cle = JSON.stringify(corps);
  const dernier = useRef(corps);
  dernier.current = corps;

  useEffect(() => {
    if (!actif) return undefined;
    if (!dernier.current.length) { setEtat({ apercu: null, erreur: null }); setCalcul(false); return undefined; }
    const controleur = new AbortController();
    setCalcul(true);
    const minuteur = setTimeout(() => {
      calculerDevis(dernier.current, { signal: controleur.signal })
        .then((apercu) => { setEtat({ apercu, erreur: null }); setCalcul(false); })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setEtat((s) => ({ ...s, erreur: e }));
          setCalcul(false);
        });
    }, delai);
    return () => { clearTimeout(minuteur); controleur.abort(); };
  }, [cle, actif, delai]);

  const erreursParLigne = useMemo(() => {
    const locales = erreursApercu(etat.apercu?.erreurs, lignes.length);
    const serveur = erreursLignes(etat.erreur).parLigne;
    return locales.map((e, i) => ({ ...e, ...(serveur[i] || {}) }));
  }, [etat, lignes.length]);

  return { apercu: lignes.length ? etat.apercu : null, erreursParLigne, erreurGenerale: etat.erreur, calcul };
}
