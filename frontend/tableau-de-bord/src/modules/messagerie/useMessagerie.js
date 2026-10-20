// État de la page Messagerie : liste des conversations (critères dans l'adresse), conversation ouverte
// (`?conversation=`), ouverture depuis `?client=`, mises à jour en direct de la liste.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCriteres, useRecherche } from '@/composants/useCriteres.js';
import useListe from '@/composants/useListe.js';
import { useDirect } from '@/layout/direct.js';

import { listerConversations, marquerLu, ouvrirConversation } from './api.js';

const DELAI_RECHARGEMENT = 500; // ms : regroupe plusieurs trames d'affilée

export default function useMessagerie() {
  const { valeurs, page, modifier } = useCriteres(['q', 'non_lus', 'conversation', 'client']);
  const direct = useDirect();
  const liste = useListe(listerConversations, { nonLus: valeurs.non_lus, recherche: valeurs.q, page });
  const [saisie, changerSaisie, effacerSaisie] = useRecherche(valeurs.q, (q) => modifier({ q }));
  const [ouverte, setOuverte] = useState(null); // conversation obtenue par POST, peut être hors de la page affichée
  const [erreur, setErreur] = useState(null);
  const selectionId = Number(valeurs.conversation) || null;
  const listeRef = useRef(liste);
  listeRef.current = liste;
  const selectionRef = useRef(selectionId);
  selectionRef.current = selectionId;
  const minuteur = useRef(null);
  const { recharger } = liste;

  const selection = liste.elements.find((c) => c.id === selectionId) || (ouverte?.id === selectionId ? ouverte : null);

  const planifierRechargement = useCallback(() => {
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(recharger, DELAI_RECHARGEMENT);
  }, [recharger]);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  // Ouverture depuis un lien « Écrire » (?client=<id>).
  const clientDemande = valeurs.client;
  useEffect(() => {
    if (!clientDemande) return;
    ouvrirConversation(Number(clientDemande))
      .then((conversation) => {
        setOuverte(conversation);
        modifier({ client: '', conversation: conversation.id });
        recharger();
      })
      .catch((e) => { setErreur(e); modifier({ client: '' }); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientDemande]);

  // Messages en direct : aperçu, pastille et ordre de la liste.
  useEffect(() => direct.abonner((trame) => {
    if (trame.type === 'message' && trame.message) {
      const m = trame.message;
      const connue = listeRef.current.elements.find((c) => c.id === m.conversation);
      if (connue) {
        const lueTout_de_suite = selectionRef.current === m.conversation && document.visibilityState === 'visible';
        listeRef.current.remplacer({
          id: m.conversation,
          dernier_message: { texte: String(m.texte || '').slice(0, 120), auteur_role: m.auteur_role, cree_le: m.cree_le },
          dernier_message_le: m.cree_le,
          non_lus: m.auteur_role === 'client' && !lueTout_de_suite ? (connue.non_lus || 0) + 1 : connue.non_lus,
        });
      }
      planifierRechargement();
    } else if (trame.type === 'lu' && trame.par === 'equipe') {
      planifierRechargement(); // un autre membre de l'équipe a lu la conversation
    }
  }), [direct, planifierRechargement]);

  const ouvrirClient = useCallback(async (client) => {
    const conversation = await ouvrirConversation(client.id);
    setOuverte(conversation);
    modifier({ conversation: conversation.id });
    recharger();
  }, [modifier, recharger]);

  const lu = useCallback(async (conversationId, jusquA) => {
    try {
      const r = await marquerLu(conversationId, jusquA);
      listeRef.current.remplacer({ id: conversationId, non_lus: Number(r?.non_lus) || 0 });
    } catch { /* la prochaine ouverture réessaiera */ }
    direct.rafraichir();
  }, [direct]);

  return {
    liste,
    page,
    saisie,
    changerSaisie,
    nonLus: valeurs.non_lus === '1',
    basculerNonLus: (actif) => modifier({ non_lus: actif ? '1' : '' }),
    filtre: Boolean(valeurs.q || valeurs.non_lus),
    effacer: () => { effacerSaisie(); modifier({ q: '', non_lus: '' }); },
    allerALaPage: (n) => modifier({ page: n }),
    selectionId,
    selection,
    choisir: (conversation) => { setOuverte(conversation); modifier({ conversation: conversation.id }); },
    fermer: () => modifier({ conversation: '' }),
    ouvrirClient,
    lu,
    erreur,
  };
}
