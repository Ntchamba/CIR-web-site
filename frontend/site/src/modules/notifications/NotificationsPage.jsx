// BF-07, BF-13 : notifications du client (/notifications) : liste paginée, tout marquer comme lu, lien vers la cible,
// préférence « nouveautés par e-mail ».
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import useListePaginee from '@/app/useListePaginee.js';
import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import * as notifications from './api.js';
import PreferenceNouveautes from './composants/PreferenceNouveautes.jsx';
import { useDirect, useEvenementsDirect } from './FondDirect.jsx';
import { cheminSur } from './lien.js';
import { useActionsNotifications } from './useNotifications.js';
import styles from './Notifications.module.css';

export default function NotificationsPage() {
  const { t } = useTraduction();
  usePageMeta(t('notifications.titre'));
  const naviguer = useNavigate();
  const { nonLuesNotifications, rattrapage } = useDirect();
  const { marquerLue, toutMarquerLu } = useActionsNotifications();
  const [seulementNonLues, setSeulementNonLues] = useState(false);
  const [lues, setLues] = useState(() => new Set()); // lectures faites dans cette page
  const [toutLu, setToutLu] = useState(false);
  const [erreurAction, setErreurAction] = useState(null);

  const liste = useListePaginee(
    ({ page, signal }) => notifications.lister({ lue: seulementNonLues ? 0 : '', page: page > 1 ? page : '' }, { signal }),
    [seulementNonLues, rattrapage],
  );

  // Une notification arrive en direct : la liste est relue.
  useEvenementsDirect((trame) => {
    if (trame.type === 'notification') liste.recharger();
  });

  const estLue = (n) => n.lue || toutLu || lues.has(n.id);

  async function ouvrir(n) {
    setErreurAction(null);
    setLues((s) => new Set(s).add(n.id));
    try {
      await marquerLue(n);
    } catch {
      /* la navigation continue */
    }
    naviguer(cheminSur(n.lien));
  }

  async function toutLire() {
    setErreurAction(null);
    try {
      await toutMarquerLu();
      setToutLu(true);
    } catch (erreur) {
      setErreurAction(erreur);
    }
  }

  return (
    <div className={`conteneur section ${styles.page}`}>
      <div className={styles.entetePage}>
        <div>
          <h1 className="titre-page">{t('notifications.titre')}</h1>
          <p className={styles.intro}>{t('notifications.intro')}</p>
        </div>
        <Bouton variante="contour" onClick={toutLire} disabled={nonLuesNotifications === 0 && !liste.elements.some((n) => !estLue(n))}>
          {t('notifications.toutLire')}
        </Bouton>
      </div>

      <div className={styles.filtres} role="group" aria-label={t('notifications.filtre.libelle')}>
        <button type="button" className={`${styles.filtre} ${seulementNonLues ? '' : styles.filtreActif}`}
          aria-pressed={!seulementNonLues} onClick={() => setSeulementNonLues(false)}>
          {t('notifications.filtre.toutes')}
        </button>
        <button type="button" className={`${styles.filtre} ${seulementNonLues ? styles.filtreActif : ''}`}
          aria-pressed={seulementNonLues} onClick={() => setSeulementNonLues(true)}>
          {t('notifications.filtre.nonLues')}
        </button>
      </div>

      <MessageErreur erreur={erreurAction} />
      {liste.chargement && liste.elements.length === 0 && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && liste.elements.length === 0 && (
        <p className={styles.vide}>{seulementNonLues ? t('notifications.videNonLues') : t('notifications.vide')}</p>
      )}
      {liste.elements.length > 0 && (
        <ul className={styles.liste} aria-label={t('notifications.liste')}>
          {liste.elements.map((n) => (
            <li key={n.id}>
              <Link to={cheminSur(n.lien)} onClick={(e) => { e.preventDefault(); ouvrir(n); }}
                className={`${styles.carte} ${estLue(n) ? '' : styles.nonLue}`}>
                <span className={styles.elementTitre}>
                  {!estLue(n) && <span className={styles.etiquetteNonLue}>{t('notifications.nonLue')}</span>}
                  {n.titre}
                </span>
                {n.texte && <span className={styles.elementTexte}>{n.texte}</span>}
                <time className={styles.meta} dateTime={n.cree_le}>{dateHeure(n.cree_le)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <VoirPlus liste={liste} />

      <PreferenceNouveautes />
    </div>
  );
}
