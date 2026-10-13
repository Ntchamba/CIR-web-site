// Fil de discussion avec l'équipe du CIR (messagerie instantanée).
import { useEffect, useRef, useState } from 'react';

import Icone from '@/components/ui/Icone.jsx';
import MessageErreur from '@/components/ui/MessageErreur.jsx';
import { heure } from '@shared/format.js';

import useConversation from './useConversation.js';
import styles from './Messagerie.module.css';

const ETATS = { connexion: 'Connexion…', reconnexion: 'Reconnexion…', coupe: 'Hors ligne : nouvel essai en cours', refuse: 'Accès refusé' };

export default function FilMessages({ conversationId, titre = "Échanges avec l'équipe" }) {
  const { messages, etat, erreur, envoyer, equipeEcrit, signalerSaisie } = useConversation(conversationId);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const bas = useRef(null);
  const derniereSaisie = useRef(0);

  useEffect(() => { bas.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length, equipeEcrit]);

  async function soumettre(e) {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    try { await envoyer(texte); setTexte(''); } finally { setEnvoi(false); }
  }

  function saisir(e) {
    setTexte(e.target.value);
    if (Date.now() - derniereSaisie.current > 2000) { derniereSaisie.current = Date.now(); signalerSaisie(); }
  }

  return (
    <section className={styles.fil} aria-label={titre}>
      <div className={styles.filEntete}>
        <h3>{titre}</h3>
        <span className={`${styles.etat} ${etat === 'ouvert' ? styles.enLigne : ''}`}>
          {etat === 'ouvert' ? 'En direct' : ETATS[etat] || ''}
        </span>
      </div>
      <MessageErreur erreur={erreur} />
      <ol className={styles.messages} aria-live="polite">
        {messages.length === 0 && !erreur && (
          <li className={styles.vide}>Posez votre question : l'équipe vous répond ici.</li>
        )}
        {messages.map((m) => (
          <li key={m.id}
            className={m.est_systeme ? styles.systeme : m.de_l_equipe ? styles.equipe : styles.moi}>
            {!m.est_systeme && <span className={styles.auteur}>{m.de_l_equipe ? 'Équipe CIR' : 'Vous'} · {heure(m.cree_le)}</span>}
            <span className={styles.texte}>{m.texte}</span>
          </li>
        ))}
        {equipeEcrit && <li className={styles.saisie}>L'équipe écrit…</li>}
        <li ref={bas} aria-hidden="true" />
      </ol>
      <form className={styles.saisieZone} onSubmit={soumettre}>
        <label className="visuellement-cache" htmlFor={`msg-${conversationId}`}>Votre message</label>
        <textarea id={`msg-${conversationId}`} rows={2} value={texte} onChange={saisir} placeholder="Votre message…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) soumettre(e); }} />
        <button type="submit" disabled={envoi || !texte.trim()} aria-label="Envoyer">
          <Icone nom="envoyer" />
        </button>
      </form>
    </section>
  );
}
