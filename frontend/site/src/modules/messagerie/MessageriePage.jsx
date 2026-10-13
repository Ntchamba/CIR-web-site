// Messagerie du client : ses conversations avec l'équipe (commandes et questions générales).
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import Bouton from '@/components/ui/Bouton.jsx';
import Chargement from '@/components/ui/Chargement.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import useApi from '@/hooks/useApi.js';
import usePageMeta from '@/hooks/usePageMeta.js';
import { depuis } from '@shared/format.js';

import * as messagerie from './api.js';
import FilMessages from './FilMessages.jsx';
import styles from './Messagerie.module.css';

export default function MessageriePage() {
  usePageMeta('Messagerie');
  const { id } = useParams();
  const { state } = useLocation();
  const naviguer = useNavigate();
  const liste = useApi((s) => messagerie.conversations(s), [id]);
  const [creation, setCreation] = useState(false);

  // Arrivée depuis une fiche produit (« Envoyer un message à l'équipe ») : nouvelle conversation.
  useEffect(() => {
    if (!state?.sujet || creation) return;
    setCreation(true);
    messagerie.creerConversation(state.sujet)
      .then((c) => naviguer(`/messagerie/${c.id}`, { replace: true, state: null }))
      .finally(() => setCreation(false));
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const conversations = liste.donnees || [];
  const active = id ? Number(id) : conversations[0]?.id;

  async function nouvelle() {
    const c = await messagerie.creerConversation("Question à l'équipe");
    naviguer(`/messagerie/${c.id}`);
  }

  return (
    <div className={`conteneur ${styles.page}`}>
      <div className={styles.titre}>
        <h1 className="titre-page">Messagerie</h1>
        <Bouton variante="contour" taille="petit" onClick={nouvelle}>Nouvelle question</Bouton>
      </div>
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {liste.chargement && !liste.donnees ? <Chargement /> : (
        <div className={styles.mise}>
          <nav className={styles.liste} aria-label="Conversations">
            {conversations.length === 0 && <p className={styles.vide}>Aucune conversation pour l'instant.</p>}
            {conversations.map((c) => (
              <Link key={c.id} to={`/messagerie/${c.id}`}
                className={`${styles.conversation} ${c.id === active ? styles.conversationActive : ''}`}>
                <span className={styles.sujet}>{c.sujet}</span>
                <span className={styles.apercu}>{c.dernier_message?.texte || 'Pas encore de message'}</span>
                <span className={styles.meta}>
                  {depuis(c.modifie_le)}
                  {c.non_lus > 0 && <span className={styles.pastille}>{c.non_lus}</span>}
                </span>
              </Link>
            ))}
          </nav>
          {active ? <FilMessages key={active} conversationId={active}
            titre={conversations.find((c) => c.id === active)?.sujet} /> : (
            <div className={styles.vide}>Choisissez une conversation, ou posez une nouvelle question.</div>
          )}
        </div>
      )}
    </div>
  );
}
