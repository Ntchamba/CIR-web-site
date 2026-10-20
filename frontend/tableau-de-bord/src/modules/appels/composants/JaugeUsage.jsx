// Jauge d'utilisation de l'offre gratuite JaaS : clients distincts ayant eu un appel ce mois-ci, sur la limite gratuite.
// Alerte à partir de 80 % de la limite, puis dépassement.
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from '../Appels.module.css';

export default function JaugeUsage({ usage }) {
  const { t, locale } = useTraduction();
  const { donnees, chargement, erreur, recharger } = usage;

  if (chargement && !donnees) return <Chargement texte={t('appels.usage.chargement')} />;
  if (erreur) {
    if (erreur.donnees?.code === 'appels_non_configures') return null; // le message de configuration est affiché par la page
    return <MessageErreur erreur={erreur} reessayer={recharger} />;
  }
  if (!donnees) return null;

  const actifs = Number(donnees.utilisateurs_actifs) || 0;
  const limite = Number(donnees.limite_gratuite) || 0;
  const part = limite > 0 ? Math.min(100, Math.round((actifs / limite) * 100)) : 0;
  const ton = donnees.depasse ? 'depasse' : donnees.proche ? 'proche' : 'normal';
  let mois = donnees.mois || '';
  const [annee, numero] = String(mois).split('-').map(Number);
  if (annee && numero) mois = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(annee, numero - 1, 1));

  return (
    <section className={`carte ${styles.usage}`} aria-labelledby="usage-titre">
      <h2 id="usage-titre" className={styles.titreCarte}>{t('appels.usage.titre')}</h2>
      <p className={styles.usageTexte}>{t('appels.usage.texte', { n: actifs, limite })}</p>
      <div className={`${styles.jauge} ${styles[`jauge_${ton}`]}`} role="meter" aria-valuemin={0} aria-valuemax={limite}
        aria-valuenow={Math.min(actifs, limite)} aria-label={t('appels.usage.jauge', { n: actifs, limite })}>
        <span style={{ width: `${part}%` }} />
      </div>
      <p className={styles.usageMois}>{t('appels.usage.mois', { mois })}</p>
      {ton !== 'normal' && (
        <p className={styles.alerteUsage} role="alert">
          {donnees.depasse ? t('appels.usage.depasse') : t('appels.usage.proche')}
        </p>
      )}
    </section>
  );
}
