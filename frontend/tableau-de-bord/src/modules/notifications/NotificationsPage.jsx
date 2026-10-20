// BF-07, BF-13 : centre de notifications de l'équipe. Onglet « Mes notifications » pour tous ; « Modèles d'e-mails »
// et « Envois » pour le super-administrateur seulement.
import { lazy, Suspense } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import Onglets from '@/composants/Onglets.jsx';
import { useCriteres } from '@/composants/useCriteres.js';
import gestion from '@/composants/Gestion.module.css';
import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import ElementNotification from './composants/ElementNotification.jsx';
import useNotifications from './useNotifications.js';
import styles from './Notifications.module.css';

const ModelesEmailsPage = lazy(() => import('./ModelesEmailsPage.jsx'));
const EnvoisEmails = lazy(() => import('./composants/EnvoisEmails.jsx'));

function MesNotifications() {
  const { t } = useTraduction();
  const {
    elements, total, suivante, precedente, page, chargement, erreur, recharger, lire, toutLu, allerALaPage,
    preferences, erreurPreferences, changerPreference,
  } = useNotifications();
  const pages = Math.max(1, Math.ceil(total / 24));
  const nonLues = elements.some((x) => !x.lue);

  return (
    <div className={styles.mes}>
      <div className={`carte ${styles.preference}`}>
        <label className={gestion.case}>
          <input type="checkbox" checked={Boolean(preferences?.email_equipe)} disabled={!preferences}
            onChange={(e) => changerPreference(e.target.checked)} />
          <span>{t('notifications.preference.emailEquipe')}</span>
        </label>
        <p className={gestion.aide}>{t('notifications.preference.aide')}</p>
        {erreurPreferences && <MessageErreur erreur={erreurPreferences} />}
      </div>

      <div className={styles.barre}>
        <p className={gestion.compte} aria-live="polite">{t('notifications.nombre', { n: total })}</p>
        <Bouton variante="contour" taille="petit" onClick={toutLu} disabled={!nonLues}>{t('notifications.toutLu')}</Bouton>
      </div>

      {chargement && elements.length === 0 ? (
        <Chargement texte={t('notifications.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={t('notifications.aucune')}>{t('notifications.aucuneTexte')}</EtatVide>
      ) : (
        <>
          <ul className={`carte ${styles.liste}`} aria-label={t('notifications.liste')}>
            {elements.map((x) => <ElementNotification key={x.id} notification={x} surLecture={lire} />)}
          </ul>
          {(precedente || suivante) && (
            <nav className={gestion.pagination} aria-label={t('notifications.pagination')}>
              <Bouton variante="contour" taille="petit" disabled={!precedente} onClick={() => allerALaPage(page - 1)}>
                {t('pagination.precedente')}
              </Bouton>
              <span>{t('pagination.pageSur', { page, pages })}</span>
              <Bouton variante="contour" taille="petit" disabled={!suivante} onClick={() => allerALaPage(page + 1)}>
                {t('pagination.suivante')}
              </Bouton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useTraduction();
  usePageMeta(t('notifications.titre'));
  const { superAdmin } = useAuth();
  const { valeurs, modifier } = useCriteres(['onglet']);
  const onglet = valeurs.onglet || 'mes';
  const choisirOnglet = (cle) => modifier({ onglet: cle === 'mes' ? '' : cle });

  const onglets = [{ cle: 'mes', libelle: t('notifications.onglets.mes') }];
  if (superAdmin) {
    onglets.push({ cle: 'modeles', libelle: t('notifications.onglets.modeles') });
    onglets.push({ cle: 'envois', libelle: t('notifications.onglets.envois') });
  }
  const actif = onglets.some((o) => o.cle === onglet) ? onglet : 'mes';

  return (
    <div className={styles.page}>
      <div>
        <h1 className="titre-page">{t('notifications.titre')}</h1>
        <p className="sous-titre-page">{t('notifications.sousTitre')}</p>
      </div>
      <Onglets libelle={t('notifications.onglets.libelle')} idBase="notifications" onglets={onglets} actif={actif}
        surChoix={choisirOnglet}>
        <Suspense fallback={<Chargement />}>
          {actif === 'mes' && <MesNotifications />}
          {actif === 'modeles' && superAdmin && <ModelesEmailsPage />}
          {actif === 'envois' && superAdmin && <EnvoisEmails />}
        </Suspense>
      </Onglets>
    </div>
  );
}
