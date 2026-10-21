// Bouton « Voir plus » sous une liste paginée, avec le compte affiché (tant qu'il reste des éléments) et l'erreur éventuelle.
import Bouton from '@partage/ui/Bouton.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './Composants.module.css';

export default function VoirPlus({ liste }) {
  const { t } = useTraduction();
  const { elements, total, suivant, chargementSuite, erreurSuite, voirPlus } = liste;
  if (!elements.length) return null;
  return (
    <div className={styles.voirPlus}>
      {suivant && <p className={styles.compte} aria-live="polite">{t('liste.affiches', { n: elements.length, total })}</p>}
      <MessageErreur erreur={erreurSuite} reessayer={erreurSuite ? voirPlus : undefined} />
      {suivant && (
        <Bouton variante="contour" onClick={voirPlus} chargement={chargementSuite}>{t('liste.voirPlus')}</Bouton>
      )}
    </div>
  );
}
