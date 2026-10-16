// BF-03 : démos vidéo (fichier envoyé ou lien YouTube / Vimeo). Liste, création, modification, suppression.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import TiroirDemo from './composants/TiroirDemo.jsx';
import { useDemos, useRealisations } from './useVitrine.js';

const adresse = (image) => (typeof image === 'string' ? image : image?.url) || '';

export default function DemosPage() {
  const { t } = useTraduction();
  usePageMeta(t('vitrine.demos.titre'));
  const { elements, total, chargement, erreur, recharger, remplacer, retirer } = useDemos();
  const { elements: realisations } = useRealisations();
  const [ouverte, setOuverte] = useState(null);
  const [annonce, setAnnonce] = useState('');

  return (
    <section className={gestion.page} aria-labelledby="titre-demos">
      <div className={gestion.entete}>
        <h2 id="titre-demos" className={gestion.titreCarte}>{t('vitrine.demos.titre')}</h2>
        <Bouton onClick={() => { setOuverte('nouvelle'); setAnnonce(''); }}>{t('vitrine.demos.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      {chargement ? (
        <Chargement texte={t('vitrine.demos.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={t('vitrine.demos.vide')}>{t('vitrine.demos.videTexte')}</EtatVide>
      ) : (
        <>
          <p className={gestion.compte}>{t('vitrine.demos.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('vitrine.demos.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visuellement-cache">{t('vitrine.colonnes.photo')}</span></th>
                  <th scope="col">{t('vitrine.colonnes.demo')}</th>
                  <th scope="col">{t('vitrine.colonnes.source')}</th>
                  <th scope="col">{t('vitrine.colonnes.duree')}</th>
                  <th scope="col">{t('vitrine.colonnes.statut')}</th>
                  <th scope="col">{t('vitrine.colonnes.traductions')}</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((d) => (
                  <tr key={d.id}>
                    <td>{adresse(d.miniature) ? <img src={adresse(d.miniature)} alt="" className={gestion.vignette} loading="lazy" />
                      : <span className={gestion.vignette} aria-hidden="true" />}</td>
                    <td><button type="button" className={gestion.nom} onClick={() => { setOuverte(d); setAnnonce(''); }}>{d.titre}</button></td>
                    <td>{d.video ? t('vitrine.demos.sourceFichier') : d.lien ? t('vitrine.demos.sourceLien') : '—'}</td>
                    <td>{d.duree || '—'}</td>
                    <td><span className={`${gestion.pastille} ${d.publie ? gestion.ok : gestion.neutre}`}>
                      {d.publie ? t('vitrine.publiee') : t('vitrine.masquee')}</span></td>
                    <td>{d.langues_incompletes?.length ? <PastilleTraductions langues={d.langues_incompletes} />
                      : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ouverte && (
        <TiroirDemo key={ouverte === 'nouvelle' ? 'nouvelle' : ouverte.id} demo={ouverte === 'nouvelle' ? null : ouverte}
          realisations={realisations} surFermeture={() => setOuverte(null)}
          surEnregistrement={(d) => { remplacer(d); setOuverte(null); setAnnonce(t('vitrine.demos.enregistree', { titre: d.titre })); }}
          surSuppression={(d) => { retirer(d.id); setOuverte(null); setAnnonce(t('vitrine.demos.supprimee', { titre: d.titre })); }} />
      )}
    </section>
  );
}
