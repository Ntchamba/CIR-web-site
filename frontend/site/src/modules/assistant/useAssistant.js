// État de l'assistant : disponibilité, conversation (clé gardée dans localStorage), envoi optimiste, avis, effacement.
// Un seul envoi à la fois ; le texte de l'utilisateur est rendu dans le champ si l'envoi échoue (réessai possible).
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import * as api from './api.js';
import { lireContexte } from './contexte.js';
import { cleErreur, ecrireCle, lireCle, oublierCle, texteEnvoyable } from './regles.js';

/** {pret, configure, ouvert} : sans réponse du serveur, l'assistant est considéré comme absent (bulle masquée). */
export function useDisponibilite() {
  const [etat, setEtat] = useState({ pret: false, configure: false, ouvert: false });
  useEffect(() => {
    const controleur = new AbortController();
    api.disponibilite({ signal: controleur.signal })
      .then((d) => setEtat({ pret: true, configure: d?.configure === true, ouvert: d?.ouvert === true }))
      .catch((e) => {
        if (e?.name !== 'AbortError') setEtat({ pret: true, configure: false, ouvert: false });
      });
    return () => controleur.abort();
  }, []);
  return etat;
}

const normaliser = (m) => ({
  id: m.id,
  role: m.role === 'utilisateur' ? 'utilisateur' : 'assistant',
  texte: typeof m.texte === 'string' ? m.texte : '',
  liens: Array.isArray(m.liens) ? m.liens : [],
  bloque: m.bloque === true,
  utile: typeof m.utile === 'boolean' ? m.utile : null, // avis déjà donné (absent chez un serveur plus ancien : null)
});

export default function useAssistant({ ouvert }) {
  const { connecte, pret } = useAuth();
  const { langue } = useTraduction();
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null); // clé de texte traduit
  const [proposerContact, setProposerContact] = useState(false);
  const [avis, setAvis] = useState({}); // id → true | false
  const [nonConfigure, setNonConfigure] = useState(false);
  const cle = useRef(null);
  const initialise = useRef(false);
  const charge = useRef(false);
  const occupe = useRef(false);
  const compteur = useRef(0);
  const connectePrecedent = useRef(null);
  const actif = useRef(true);

  useEffect(() => {
    actif.current = true;
    return () => { actif.current = false; };
  }, []);

  const reinitialiser = useCallback(() => {
    oublierCle();
    cle.current = null;
    charge.current = false;
    setMessages([]);
    setAvis({});
    setProposerContact(false);
    setErreur(null);
  }, []);

  // Clé reprise au rechargement ; la conversation d'un compte n'est plus proposée une fois déconnecté.
  useEffect(() => {
    if (!pret) return;
    const stockee = lireCle();
    if (!initialise.current) {
      initialise.current = true;
      if (stockee && stockee.connecte && !connecte) reinitialiser();
      else cle.current = stockee?.cle ?? null;
    } else if (connectePrecedent.current && !connecte) {
      reinitialiser();
    }
    connectePrecedent.current = connecte;
  }, [pret, connecte, reinitialiser]);

  // Historique rechargé à l'ouverture.
  useEffect(() => {
    if (!ouvert || !pret || !initialise.current || charge.current || !cle.current) return;
    charge.current = true;
    const cleCourante = cle.current;
    setChargement(true);
    api.conversation(cleCourante)
      .then((d) => {
        if (!actif.current || cle.current !== cleCourante) return;
        setMessages((deja) => (deja.length ? deja : (d?.messages || []).map(normaliser)));
      })
      .catch((e) => {
        if (!actif.current || cle.current !== cleCourante) return;
        if (e?.statut === 404) reinitialiser(); // clé inconnue : oubliée
        else {
          charge.current = false;
          setErreur('assistant.erreurs.historique');
        }
      })
      .finally(() => actif.current && setChargement(false));
  }, [ouvert, pret, reinitialiser]);

  const envoyer = useCallback(async (force) => {
    const brut = texteEnvoyable(force ?? texte);
    if (!brut || occupe.current || chargement) return;
    occupe.current = true;
    setEnvoi(true);
    setErreur(null);
    setProposerContact(false);
    compteur.current += 1;
    const local = { id: `local-${compteur.current}`, role: 'utilisateur', texte: brut, liens: [], bloque: false, utile: null };
    setMessages((m) => [...m, local]);
    setTexte('');
    const corps = { texte: brut, langue, contexte: lireContexte() };
    try {
      let reponse;
      try {
        reponse = await api.envoyer(cle.current ? { ...corps, cle: cle.current } : corps);
      } catch (e) {
        if (e?.statut !== 404 || !cle.current) throw e;
        oublierCle(); // clé d'un autre compte ou inconnue : nouvelle conversation
        cle.current = null;
        reponse = await api.envoyer(corps);
      }
      if (!actif.current) return;
      if (reponse?.cle) {
        cle.current = reponse.cle;
        charge.current = true;
        ecrireCle(reponse.cle, connecte);
      }
      setMessages((m) => [...m, normaliser(reponse.message)]);
      setProposerContact(reponse?.proposer_contact === true);
    } catch (e) {
      if (!actif.current) return;
      setMessages((m) => m.filter((x) => x.id !== local.id));
      setTexte((courant) => courant || brut); // le message est conservé pour réessayer
      const cleTexte = cleErreur(e);
      if (e?.donnees?.code === 'assistant_non_configure') setNonConfigure(true);
      setErreur(cleTexte);
    } finally {
      occupe.current = false;
      if (actif.current) setEnvoi(false);
    }
  }, [texte, langue, connecte, chargement]);

  const effacer = useCallback(async () => {
    if (cle.current) {
      try {
        await api.effacer(cle.current);
      } catch (e) {
        if (e?.statut !== 404) {
          if (actif.current) setErreur('assistant.erreurs.generique');
          return false;
        }
      }
    }
    if (actif.current) reinitialiser();
    return true;
  }, [reinitialiser]);

  const donnerAvis = useCallback(async (id, utile) => {
    if (avis[id] !== undefined) return;
    setAvis((a) => ({ ...a, [id]: utile }));
    try {
      await api.donnerAvis(id, utile, cle.current);
    } catch (e) {
      if (!actif.current) return;
      if (e?.statut === 409) return; // avis déjà donné : remerciement, pas d'erreur
      setAvis((a) => {
        const { [id]: _retire, ...reste } = a;
        return reste;
      });
      setErreur('assistant.erreurs.avis');
    }
  }, [avis]);

  return {
    messages, texte, setTexte, envoi, chargement, erreur, proposerContact, avis, nonConfigure, connecte,
    envoyer, effacer, donnerAvis, fermerErreur: () => setErreur(null),
  };
}
