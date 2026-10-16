// BF-02 : réalisations (photos avant / après des chantiers). Liste, création, modification, suppression.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import { libelleUsage } from '@/composants/usages.js';
import gestion from '@/composants/Gestion.module.css';

import TiroirRealisation from './composants/TiroirRealisation.jsx';
import { useRealisations } from './useVitrine.js';

const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';

export default function RealisationsPage() {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.realisations.titre'));
  const { elements, total, chargement, erreur, recharger, remplacer, retirer } = useRealisations();
  const [ouverte, setOuverte] = useState(null);
  const [annonce, setAnnonce] = useState('');

  return (
    <section className={gestion.page} aria-labelledby="titre-realisations">
      <div className={gestion.entete}>
        <h2 id="titre-realisations" className={gestion.titreCarte}>{t('vitrine.realisations.titre')}</h2>
        <Bouton onClick={() => { setOuverte('nouvelle'); setAnnonce(''); }}>{t('vitrine.realisations.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      {chargement ? (
        <Chargement texte={t('vitrine.realisations.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={t('vitrine.realisations.vide')}>{t('vitrine.realisations.videTexte')}</EtatVide>
      ) : (
        <>
          <p className={gestion.compte}>{t('vitrine.realisations.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('vitrine.realisations.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visuellement-cache">{t('vitrine.colonnes.photo')}</span></th>
                  <th scope="col">{t('vitrine.colonnes.realisation')}</th>
                  <th scope="col">{t('vitrine.colonnes.type')}</th>
                  <th scope="col">{t('vitrine.colonnes.date')}</th>
                  <th scope="col">{t('vitrine.colonnes.statut')}</th>
                  <th scope="col">{t('vitrine.colonnes.traductions')}</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((r) => (
                  <tr key={r.id}>
                    <td>{adresse(r.image_apres) ? <img src={adresse(r.image_apres)} alt="" className={gestion.vignette} loading="lazy" />
                      : <span className={gestion.vignette} aria-hidden="true" />}</td>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => { setOuverte(r); setAnnonce(''); }}>{r.titre}</button>
                      {r.ville && <span className={gestion.secondaire}>{r.ville}</span>}
                    </td>
                    <td>{libelleUsage(r.type_chantier) || '—'}</td>
                    <td>{r.date ? date(r.date) : '—'}</td>
                    <td><span className={`${gestion.pastille} ${r.publie ? gestion.ok : gestion.neutre}`}>
                      {r.publie ? t('vitrine.publiee') : t('vitrine.masquee')}</span></td>
                    <td>{r.langues_incompletes?.length ? <PastilleTraductions langues={r.langues_incompletes} />
                      : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ouverte && (
        <TiroirRealisation key={ouverte === 'nouvelle' ? 'nouvelle' : ouverte.id}
          realisation={ouverte === 'nouvelle' ? null : ouverte} surFermeture={() => setOuverte(null)}
          surEnregistrement={(r) => { remplacer(r); setOuverte(null); setAnnonce(t('vitrine.realisations.enregistree', { titre: r.titre })); }}
          surSuppression={(r) => { retirer(r.id); setOuverte(null); setAnnonce(t('vitrine.realisations.supprimee', { titre: r.titre })); }} />
      )}
    </section>
  );
}
