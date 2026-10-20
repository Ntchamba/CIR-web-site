// Une notification : titre et texte venus du serveur (déjà dans la langue de la requête), lien vers sa cible.
import { Link } from 'react-router';

import { depuis } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { lienInterne } from './lien.js';
import styles from '../Notifications.module.css';

export default function ElementNotification({ notification, surLecture, surNavigation }) {
  const { t } = useTraduction();
  const lien = lienInterne(notification.lien);
  const contenu = (
    <>
      {!notification.lue && <span className={styles.point} aria-hidden="true" />}
      <span className={styles.texteNotification}>
        <strong>{notification.titre}</strong>
        {notification.texte && <span>{notification.texte}</span>}
        <small>
          {!notification.lue && <span className="visuellement-cache">{t('notifications.nonLue')} · </span>}
          {depuis(notification.cree_le)}
        </small>
      </span>
    </>
  );
  const classe = `${styles.element} ${notification.lue ? '' : styles.nonLue}`;
  return (
    <li>
      {lien ? (
        <Link to={lien} className={classe} onClick={() => { surLecture?.(notification); surNavigation?.(); }}>{contenu}</Link>
      ) : (
        <button type="button" className={classe} onClick={() => surLecture?.(notification)}>{contenu}</button>
      )}
    </li>
  );
}
