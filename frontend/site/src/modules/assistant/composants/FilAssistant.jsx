// Fil de la conversation (role="log", annonce polie). Le texte est affiché en texte brut avec retours à la ligne :
// jamais de HTML, jamais de Markdown, aucune adresse du texte n'est cliquable. Seuls les `liens` du serveur le sont.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import { liensSurs } from '../regles.js';
import styles from '../Assistant.module.css';

function Avis({ message, valeur, donnerAvis }) {
  const { t } = useTraduction();
  if (valeur !== undefined) return <p className={styles.merci}>{t('assistant.avis.merci')}</p>;
  return (
    <div className={styles.avis} role="group" aria-label={t('assistant.avis.question')}>
      <button type="button" className={styles.avisBouton} aria-label={t('assistant.avis.utile')} onClick={() => donnerAvis(message.id, true)}>
        <span aria-hidden="true">👍</span>
      </button>
      <button type="button" className={styles.avisBouton} aria-label={t('assistant.avis.inutile')} onClick={() => donnerAvis(message.id, false)}>
        <span aria-hidden="true">👎</span>
      </button>
    </div>
  );
}

export default function FilAssistant({ messages, envoi, avis, donnerAvis, surLien }) {
  const { t } = useTraduction();
  const fil = useRef(null);

  useEffect(() => {
    if (fil.current) fil.current.scrollTop = fil.current.scrollHeight;
  }, [messages.length, envoi]);

  return (
    <div ref={fil} className={styles.fil} role="log" aria-live="polite" aria-relevant="additions" aria-label={t('assistant.fil')} tabIndex={0}>
      {messages.map((m) => {
        const moi = m.role === 'utilisateur';
        const liens = moi ? [] : liensSurs(m.liens);
        return (
          <article key={m.id} className={`${styles.message} ${moi ? styles.moi : styles.assistant}`}>
            <span className="visuellement-cache">{moi ? t('assistant.auteurVous') : t('assistant.auteurAssistant')}</span>
            <p className={styles.texte}>{m.texte}</p>
            {liens.length > 0 && (
              <ul className={styles.liens}>
                {liens.map((l) => (
                  <li key={l.chemin + l.libelle}>
                    <Link to={l.chemin} onClick={surLien}>{l.libelle}<Icone nom="fleche" taille={16} /></Link>
                  </li>
                ))}
              </ul>
            )}
            {!moi && typeof m.id === 'number' && <Avis message={m} valeur={avis[m.id]} donnerAvis={donnerAvis} />}
          </article>
        );
      })}
      {envoi && <p className={styles.ecrit}>{t('assistant.ecrit')}</p>}
    </div>
  );
}
