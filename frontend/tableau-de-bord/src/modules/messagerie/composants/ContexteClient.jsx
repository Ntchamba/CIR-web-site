// En-tête du fil : retour (téléphone), nom du client, téléphone et e-mail cliquables, liens vers sa fiche et ses commandes.
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';
import { infosLangue } from '@partage/i18n/langues.js';

import LiensContact from '@/composants/LiensContact.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Messagerie.module.css';

export default function ContexteClient({ client, nom, surRetour }) {
  const { t } = useTraduction();
  return (
    <header className={styles.contexte}>
      <button type="button" className={styles.retour} onClick={surRetour}>
        <Icone nom="retour" taille={18} /> <span>{t('messagerie.retour')}</span>
      </button>
      {client ? (
        <div className={styles.infosClient}>
          <h2 className={styles.nomClient}>{client.nom_complet || client.email}</h2>
          <LiensContact email={client.email} telephone={client.telephone} />
          <p className={styles.liensClient}>
            <Link to={`/clients/${client.id}`}>{t('messagerie.fiche')}</Link>
            <Link to={`/commandes?client=${client.id}`}>{t('messagerie.commandes')}</Link>
            {client.langue && <span>{t('messagerie.langueClient', { langue: infosLangue(client.langue).nom })}</span>}
          </p>
        </div>
      ) : (
        <h2 className={styles.nomClient}>{nom || t('messagerie.conversation')}</h2>
      )}
    </header>
  );
}
