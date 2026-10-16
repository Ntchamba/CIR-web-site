// Message d'erreur lisible (texte ou ErreurApi), avec un bouton « Réessayer » si `reessayer` est fourni.
import useTraduction from '../i18n/useTraduction.js';
import styles from './ui.module.css';

export default function MessageErreur({ erreur, reessayer }) {
  const { t } = useTraduction();
  if (!erreur) return null;
  const texte = typeof erreur === 'string' ? erreur : erreur.message || t('commun.erreurInconnue');
  return (
    <div className={styles.erreur} role="alert">
      <span>{texte}</span>
      {reessayer && <button type="button" onClick={reessayer}>{t('commun.reessayer')}</button>}
    </div>
  );
}
