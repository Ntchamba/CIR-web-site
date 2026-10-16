// Indique si l'adresse du client est complète (condition pour commander).
import { useTraduction } from '@/i18n/index.js';

import styles from '../Clients.module.css';

export default function PastilleAdresse({ complete }) {
  const { t } = useTraduction();
  return (
    <span className={`${styles.pastille} ${complete ? styles.ok : styles.attention}`}>
      {complete ? t('clients.adresseComplete') : t('clients.adresseIncomplete')}
    </span>
  );
}
