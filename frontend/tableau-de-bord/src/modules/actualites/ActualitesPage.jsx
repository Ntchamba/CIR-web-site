// BF-07 : actualités. Liste (publiées, programmées, brouillons), création, modification, programmation,
// suppression.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import TiroirActualite from './composants/TiroirActualite.jsx';
import useActualites, { etatActualite } from './useActualites.js';
import styles from './Actualites.module.css';

const CLASSES = { publiee: gestion.ok, programmee: gestion.info, brouillon: gestion.neutre };
const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';

export default function ActualitesPage() {
  const { t } = useTraduction();
  usePageMeta(t('actualites.titre'));
  const { actualites, total, chargement, erreur, recharger, remplacer, retirer } = useActualites();
  const [ouverte, setOuverte] = useState(null);
  const [annonce, setAnnonce] = useState('');

  return (
    <div className={gestion.page}>
      <div className={gestion.entete}>
        <div>
          <h1 className="titre-page">{t('actualites.titre')}</h1>
          <p className="sous-titre-page">{t('actualites.sousTitre')}</p>
        </div>
        <Bouton onClick={() => { setOuverte('nouvelle'); setAnnonce(''); }}>{t('actualites.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      {chargement ? (
        <Chargement texte={t('actualites.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : actualites.length === 0 ? (
        <EtatVide titre={t('actualites.vide')}>{t('actualites.videTexte')}</EtatVide>
      ) : (
        <>
          <p className={gestion.compte}>{t('actualites.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('actualites.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visuellement-cache">{t('actualites.colonnes.image')}</span></th>
                  <th scope="col">{t('actualites.colonnes.actualite')}</th>
                  <th scope="col">{t('actualites.colonnes.date')}</th>
                  <th scope="col">{t('actualites.colonnes.statut')}</th>
                  <th scope="col">{t('actualites.colonnes.traductions')}</th>
                </tr>
              </thead>
              <tbody>
                {actualites.map((a) => {
                  const etat = etatActualite(a);
                  return (
                    <tr key={a.id}>
                      <td>{adresse(a.image) ? <img src={adresse(a.image)} alt="" className={gestion.vignette} loading="lazy" />
                        : <span className={gestion.vignette} aria-hidden="true" />}</td>
                      <td className={styles.colonneTitre}>
                        <button type="button" className={gestion.nom} onClick={() => { setOuverte(a); setAnnonce(''); }}>{a.titre}</button>
                        {a.resume && <span className={gestion.secondaire}>{a.resume}</span>}
                      </td>
                      <td>{a.publie_le ? dateHeure(a.publie_le) : '—'}</td>
                      <td><span className={`${gestion.pastille} ${CLASSES[etat]}`}>{t(`actualites.etats.${etat}`)}</span></td>
                      <td>{a.langues_incompletes?.length ? <PastilleTraductions langues={a.langues_incompletes} />
                        : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ouverte && (
        <TiroirActualite key={ouverte === 'nouvelle' ? 'nouvelle' : ouverte.id}
          actualite={ouverte === 'nouvelle' ? null : ouverte} surFermeture={() => setOuverte(null)}
          surEnregistrement={(a) => { remplacer(a); setOuverte(null); setAnnonce(t('actualites.enregistree', { titre: a.titre })); }}
          surSuppression={(a) => { retirer(a.id); setOuverte(null); setAnnonce(t('actualites.supprimee', { titre: a.titre })); }} />
      )}
    </div>
  );
}
