// Bandeau « connexion en direct interrompue » (le site continue de fonctionner par lecture régulière).
import { useTraduction } from '@/i18n/index.js';

import { useDirect } from '../FondDirect.jsx';
import styles from '../Notifications.module.css';

export default function BandeauDirect() {
  const { t } = useTraduction();
  const { interrompu } = useDirect();
  return (
    <div role="status" aria-live="polite">
      {interrompu && <p className={styles.bandeau}>{t('direct.interrompu')}</p>}
    </div>
  );
}
