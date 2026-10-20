// BF-07 : préférence « Recevoir les nouveautés par e-mail ». Consentement : désactivée par défaut.
// Utilisée dans la page Notifications et dans le profil.
import { useEffect, useId, useState } from 'react';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import * as notifications from '../api.js';
import styles from '../Notifications.module.css';

export default function PreferenceNouveautes() {
  const { t } = useTraduction();
  const { utilisateur } = useAuth();
  const [active, setActive] = useState(Boolean(utilisateur?.recevoir_nouveautes));
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState({ type: '', texte: '' });
  const id = useId();

  // Valeur à jour du serveur (une panne ne montre rien : on garde la valeur du compte).
  useEffect(() => {
    let actif = true;
    notifications.preferences()
      .then((p) => actif && typeof p?.recevoir_nouveautes === 'boolean' && setActive(p.recevoir_nouveautes))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  async function changer(e) {
    const valeur = e.target.checked;
    setActive(valeur);
    setEnvoi(true);
    setMessage({ type: '', texte: '' });
    try {
      const p = await notifications.modifierPreferences({ recevoir_nouveautes: valeur });
      const confirmee = typeof p?.recevoir_nouveautes === 'boolean' ? p.recevoir_nouveautes : valeur;
      setActive(confirmee);
      setMessage({ type: 'ok', texte: confirmee ? t('notifications.preference.activee') : t('notifications.preference.desactivee') });
    } catch (erreur) {
      setActive(!valeur);
      setMessage({ type: 'erreur', texte: erreur.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className={styles.preference} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`}>{t('notifications.preference.titre')}</h2>
      <label className={styles.interrupteur} htmlFor={id}>
        <input id={id} type="checkbox" checked={active} onChange={changer} disabled={envoi}
          aria-describedby={`${id}-aide`} />
        <span>{t('notifications.preference.libelle')}</span>
      </label>
      <p id={`${id}-aide`} className={styles.meta}>{t('notifications.preference.aide')}</p>
      <div role="status" aria-live="polite">
        {message.texte && (
          <p className={message.type === 'ok' ? styles.ok : styles.erreurTexte}>{message.texte}</p>
        )}
      </div>
    </section>
  );
}
