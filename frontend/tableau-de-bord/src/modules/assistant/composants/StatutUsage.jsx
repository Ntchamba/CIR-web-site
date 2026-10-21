// Onglet « Statut et usage » : service configuré ou non, modèles, messages du jour sur la limite (jauge, alerte à 80 %),
// messages et jetons du mois. Aucun chiffre n'est inventé : une valeur absente s'affiche « — ».
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import PastilleEtat from '@/composants/PastilleEtat.jsx';
import { useTraduction } from '@/i18n/index.js';

import { messageErreurAssistant } from '../erreurs.js';
import styles from '../Assistant.module.css';

export const SEUIL_ALERTE = 0.8;

export default function StatutUsage({ statut }) {
  const { t, locale } = useTraduction();
  const { donnees, chargement, erreur, recharger } = statut;
  const nombre = (v) => (typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : '—');

  if (chargement && !donnees) return <Chargement texte={t('assistant.statut.chargement')} />;
  if (erreur) return <MessageErreur erreur={messageErreurAssistant(erreur)} reessayer={recharger} />;
  if (!donnees) return null;

  const limite = Number(donnees.limite_jour) || 0;
  const aujourdhui = Number(donnees.messages_aujourdhui) || 0;
  const rapport = limite > 0 ? aujourdhui / limite : 0;
  const part = Math.min(100, Math.round(rapport * 100));
  const ton = rapport >= 1 ? 'depasse' : rapport >= SEUIL_ALERTE ? 'proche' : 'normal';

  return (
    <div className={styles.section}>
      <section className={`carte ${styles.section}`} aria-labelledby="assistant-service">
        <h2 id="assistant-service" className={styles.titreSection}>{t('assistant.statut.service')}</h2>
        <p>
          <PastilleEtat ton={donnees.configure ? 'ok' : 'alerte'}>
            {donnees.configure ? t('assistant.statut.configure') : t('assistant.statut.nonConfigure')}
          </PastilleEtat>
        </p>
        {!donnees.configure && (
          <EtatVide titre={t('assistant.statut.nonConfigureTitre')} niveau={3}>{t('assistant.statut.nonConfigureTexte')}</EtatVide>
        )}
        <dl className={styles.infos}>
          <div className={styles.info}><dt>{t('assistant.statut.modeleAssistant')}</dt><dd>{donnees.modele_assistant || '—'}</dd></div>
          <div className={styles.info}><dt>{t('assistant.statut.modeleFond')}</dt><dd>{donnees.modele_fond || '—'}</dd></div>
        </dl>
      </section>

      {limite > 0 && (
        <section className={`carte ${styles.usage}`} aria-labelledby="assistant-jour">
          <h2 id="assistant-jour" className={styles.titreSection}>{t('assistant.statut.jour')}</h2>
          <p className={styles.usageTexte}>{t('assistant.statut.jourTexte', { n: nombre(aujourdhui), limite: nombre(limite) })}</p>
          <div className={`${styles.jauge} ${styles[`jauge_${ton}`]}`} role="meter" aria-valuemin={0} aria-valuemax={limite}
            aria-valuenow={Math.min(aujourdhui, limite)}
            aria-label={t('assistant.statut.jauge', { n: nombre(aujourdhui), limite: nombre(limite), pourcent: part })}>
            <span style={{ width: `${part}%` }} />
          </div>
          {ton !== 'normal' && (
            <p className={`${styles.alerteUsage} ${ton === 'depasse' ? styles.alerteUsage_depasse : ''}`} role="alert">
              {ton === 'depasse' ? t('assistant.statut.limiteAtteinte') : t('assistant.statut.limiteProche', { pourcent: part })}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="assistant-mois">
        <h2 id="assistant-mois" className={styles.titreSection}>{t('assistant.statut.mois')}</h2>
        <dl className={styles.cartes}>
          <div className={`carte ${styles.carteChiffre}`}><dt>{t('assistant.statut.messagesMois')}</dt><dd>{nombre(donnees.messages_mois)}</dd></div>
          <div className={`carte ${styles.carteChiffre}`}><dt>{t('assistant.statut.jetonsMois')}</dt><dd>{nombre(donnees.jetons_mois)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
