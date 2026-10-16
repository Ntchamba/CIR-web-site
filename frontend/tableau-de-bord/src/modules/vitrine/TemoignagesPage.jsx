// BF-04 : modération des témoignages des clients (publier, refuser avec motif, supprimer), filtre par statut.
// Les mots du client restent tels quels (jamais traduits ni modifiés, jamais de témoignage inventé).
import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import gestion from '@/composants/Gestion.module.css';

import { STATUTS_TEMOIGNAGE, TAILLE_PAGE } from './api.js';
import CarteTemoignage from './composants/CarteTemoignage.jsx';
import useVitrine from './useVitrine.js';
import styles from './Vitrine.module.css';

export default function TemoignagesPage({ surModeration }) {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.temoignages.titre'));
  const {
    temoignages, total, statut, filtrer, page, allerALaPage, suivante, precedente, chargement, erreur, recharger,
    publier, refuser, supprimer,
  } = useVitrine({ surModeration });
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <section className={gestion.page} aria-labelledby="titre-temoignages">
      <div className={gestion.entete}>
        <div>
          <h2 id="titre-temoignages" className={gestion.titreCarte}>{t('vitrine.temoignages.titre')}</h2>
          <p className={gestion.aide}>{t('vitrine.temoignages.aide')}</p>
        </div>
      </div>

      <div className={styles.filtreStatut} role="group" aria-label={t('vitrine.temoignages.filtre')}>
        {[...STATUTS_TEMOIGNAGE, ''].map((code) => (
          <button key={code || 'tous'} type="button" aria-pressed={statut === code} onClick={() => filtrer(code)}
            className={`${styles.filtre} ${statut === code ? styles.filtreActif : ''}`}>
            {code ? t(`vitrine.temoignages.filtres.${code}`) : t('vitrine.temoignages.filtres.tous')}
          </button>
        ))}
      </div>

      {chargement ? (
        <Chargement texte={t('vitrine.temoignages.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : temoignages.length === 0 ? (
        <EtatVide titre={statut === 'en_attente' ? t('vitrine.temoignages.videAttente') : t('vitrine.temoignages.vide')}>
          {t('vitrine.temoignages.videTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('vitrine.temoignages.nombre', { n: total })}</p>
          <ul className={gestion.cartes}>
            {temoignages.map((tm) => (
              <CarteTemoignage key={tm.id} temoignage={tm} publier={publier} refuser={refuser} supprimer={supprimer} />
            ))}
          </ul>
          {(precedente || suivante) && (
            <nav className={gestion.pagination} aria-label={t('vitrine.temoignages.pagination')}>
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
    </section>
  );
}
