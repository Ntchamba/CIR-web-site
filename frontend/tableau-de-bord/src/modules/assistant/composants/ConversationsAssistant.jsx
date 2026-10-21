// Lecture des conversations de l'assistant avec le public (super-administrateur seulement, voir JournalAssistant).
// Lecture seule ; chaque consultation est journalisée par le serveur. Aucun nom ni coordonnée n'est affiché.
import { useState } from 'react';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';

import gestion from '@/composants/Gestion.module.css';
import { TAILLE_PAGE } from '@/composants/useListe.js';
import useChargement from '@/composants/useChargement.js';
import Tiroir from '@/composants/Tiroir.jsx';
import { useTraduction } from '@/i18n/index.js';

import { obtenirConversation } from '../api.js';
import { libelleGardeFou, messageErreurAssistant } from '../erreurs.js';
import { useConversations } from '../useAssistant.js';
import styles from '../Assistant.module.css';

function DetailConversation({ cle, surFermeture }) {
  const { t } = useTraduction();
  const { donnees, chargement, erreur, recharger } = useChargement((signal) => obtenirConversation(cle, { signal }), [cle]);
  const messages = Array.isArray(donnees?.messages) ? donnees.messages : [];
  return (
    <Tiroir ouvert large titre={t('assistant.conversations.titre')} sousTitre={t('assistant.conversations.consultation')}
      surFermeture={surFermeture}>
      <p className={styles.avertissement}>{t('assistant.conversations.consultation')}</p>
      {chargement ? <Chargement texte={t('assistant.conversations.chargement')} />
        : erreur ? <MessageErreur erreur={messageErreurAssistant(erreur)} reessayer={recharger} />
          : messages.length === 0 ? <p>{t('assistant.conversations.vide')}</p>
            : (
              <ol className={styles.messagesConversation} aria-label={t('assistant.conversations.messages')}>
                {messages.map((m) => (
                  <li key={m.id} className={styles.messageConversation}>
                    <strong>
                      {m.role === 'assistant' ? t('assistant.conversations.assistant') : t('assistant.conversations.utilisateur')}
                      {' · '}{dateHeure(m.cree_le)}
                      {m.bloque ? ` · ${typeof m.bloque === 'string' ? libelleGardeFou(m.bloque) : t('assistant.conversations.bloque')}` : ''}
                    </strong>
                    {/* Texte brut : jamais interprété comme du HTML. */}
                    <p className={styles.texteLu}>{m.texte}</p>
                  </li>
                ))}
              </ol>
            )}
    </Tiroir>
  );
}

export default function ConversationsAssistant() {
  const { t } = useTraduction();
  const c = useConversations(true);
  const [ouverte, setOuverte] = useState(null);
  const pages = Math.max(1, Math.ceil(c.total / TAILLE_PAGE));

  if (c.chargement) return <Chargement texte={t('assistant.conversations.chargementListe')} />;
  if (c.erreur) return <MessageErreur erreur={messageErreurAssistant(c.erreur)} reessayer={c.recharger} />;
  return (
    <div className={styles.section}>
      <p className={styles.alerteGarde} role="note">{t('assistant.conversations.note')}</p>
      {c.elements.length === 0 ? (
        <EtatVide titre={t('assistant.conversations.aucune')}>{t('assistant.conversations.aucuneTexte')}</EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('assistant.conversations.nombre', { n: c.total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('assistant.conversations.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('assistant.conversations.colonnes.conversation')}</th>
                  <th scope="col">{t('assistant.conversations.colonnes.auteur')}</th>
                  <th scope="col">{t('assistant.conversations.colonnes.langue')}</th>
                  <th scope="col">{t('assistant.conversations.colonnes.activite')}</th>
                </tr>
              </thead>
              <tbody>
                {c.elements.map((conv, i) => (
                  <tr key={conv.cle}>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => setOuverte(conv.cle)}>
                        {t('assistant.conversations.ouvrir', { n: (c.page - 1) * TAILLE_PAGE + i + 1 })}
                      </button>
                    </td>
                    <td>{conv.utilisateur ? t('assistant.conversations.connecte') : t('assistant.conversations.visiteur')}</td>
                    <td>{conv.langue ? infosLangue(conv.langue).nom : '—'}</td>
                    <td>{dateHeure(conv.derniere_activite_le || conv.cree_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(c.precedente || c.suivante) && (
            <nav className={gestion.pagination} aria-label={t('assistant.conversations.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!c.precedente} onClick={() => c.allerALaPage(c.page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page: c.page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!c.suivante} onClick={() => c.allerALaPage(c.page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}
      {ouverte && <DetailConversation key={ouverte} cle={ouverte} surFermeture={() => setOuverte(null)} />}
    </div>
  );
}
