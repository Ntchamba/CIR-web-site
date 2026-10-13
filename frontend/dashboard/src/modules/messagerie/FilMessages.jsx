// Fil de discussion avec un client (côté équipe).
import { useEffect, useRef, useState } from 'react';

import Icone from '@/components/ui/Icone.jsx';
import { heure } from '@shared/format.js';

import useConversation from './useConversation.js';

export default function FilMessages({ conversationId, titre = 'Échanges avec le client' }) {
  const { messages, etat, clientEcrit, envoyer, signalerSaisie } = useConversation(conversationId);
  const [texte, setTexte] = useState('');
  const bas = useRef(null);
  const derniere = useRef(0);
  useEffect(() => { bas.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length, clientEcrit]);

  const soumettre = async (e) => { e.preventDefault(); if (!texte.trim()) return; await envoyer(texte); setTexte(''); };

  return (
    <section className="fil" aria-label={titre}>
      <div className="fil-entete">
        <h3>{titre}</h3>
        <span className={`fil-etat ${etat === 'ouvert' ? 'en-ligne' : ''}`}>{etat === 'ouvert' ? '● En direct' : 'Reconnexion…'}</span>
      </div>
      <ol className="fil-messages" aria-live="polite">
        {messages.length === 0 && <li className="msg-systeme">Pas encore de message.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.est_systeme ? 'msg-systeme' : m.de_l_equipe ? 'msg-equipe' : 'msg-client'}>
            {!m.est_systeme && <span className="auteur">{m.de_l_equipe ? 'Équipe CIR' : m.auteur_nom} · {heure(m.cree_le)}</span>}
            <span className="texte">{m.texte}</span>
          </li>
        ))}
        {clientEcrit && <li className="msg-systeme">Le client écrit…</li>}
        <li ref={bas} aria-hidden="true" />
      </ol>
      <form className="fil-saisie" onSubmit={soumettre}>
        <label className="visuellement-cache" htmlFor={`rep-${conversationId}`}>Répondre</label>
        <textarea id={`rep-${conversationId}`} rows={2} value={texte} placeholder="Répondre au client…"
          onChange={(e) => {
            setTexte(e.target.value);
            if (Date.now() - derniere.current > 2000) { derniere.current = Date.now(); signalerSaisie(); }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) soumettre(e); }} />
        <button type="submit" disabled={!texte.trim()} aria-label="Envoyer"><Icone nom="envoyer" /></button>
      </form>
    </section>
  );
}
