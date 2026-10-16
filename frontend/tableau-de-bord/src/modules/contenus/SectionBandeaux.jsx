// BF-15 : bandeaux d'annonce affichés en haut de l'accueil (actifs et dans leurs dates).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import gestion from '@/composants/Gestion.module.css';

import TiroirBandeau from './composants/TiroirBandeau.jsx';
import { etatBandeau, useBandeaux } from './useContenus.js';

const CLASSES = { actif: gestion.ok, programme: gestion.info, expire: gestion.neutre, inactif: gestion.neutre };

export default function SectionBandeaux() {
  const { t } = useTraduction();
  const { elements, chargement, erreur, recharger, remplacer, retirer } = useBandeaux();
  const [ouvert, setOuvert] = useState(null);
  const [annonce, setAnnonce] = useState('');

  const periode = (b) => {
    if (b.debut && b.fin) return t('contenus.bandeaux.du', { debut: date(b.debut), fin: date(b.fin) });
    if (b.debut) return t('contenus.bandeaux.aPartirDu', { date: date(b.debut) });
    if (b.fin) return t('contenus.bandeaux.jusquAu', { date: date(b.fin) });
    return t('contenus.bandeaux.sansPeriode');
  };

  return (
    <section className={gestion.page} aria-labelledby="titre-bandeaux">
      <div className={gestion.entete}>
        <div>
          <h2 id="titre-bandeaux" className={gestion.titreCarte}>{t('contenus.bandeaux.titre')}</h2>
          <p className={gestion.aide}>{t('contenus.bandeaux.aide')}</p>
        </div>
        <Bouton onClick={() => { setOuvert('nouveau'); setAnnonce(''); }}>{t('contenus.bandeaux.ajouter')}</Bouton>
      </div>
      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={gestion.succes}>{annonce}</p>}

      {chargement ? (
        <Chargement texte={t('contenus.bandeaux.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={t('contenus.bandeaux.vide')}>{t('contenus.bandeaux.videTexte')}</EtatVide>
      ) : (
        <div className={`carte ${gestion.tableau}`}>
          <table>
            <caption className="visuellement-cache">{t('contenus.bandeaux.legende')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('contenus.bandeaux.colonnes.texte')}</th>
                <th scope="col">{t('contenus.bandeaux.colonnes.periode')}</th>
                <th scope="col">{t('contenus.bandeaux.colonnes.statut')}</th>
                <th scope="col">{t('contenus.bandeaux.colonnes.traductions')}</th>
              </tr>
            </thead>
            <tbody>
              {elements.map((b) => {
                const etat = etatBandeau(b);
                return (
                  <tr key={b.id}>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => { setOuvert(b); setAnnonce(''); }}>{b.texte}</button>
                      {b.lien && <span className={gestion.secondaire}>{b.lien}</span>}
                    </td>
                    <td>{periode(b)}</td>
                    <td><span className={`${gestion.pastille} ${CLASSES[etat]}`}>{t(`contenus.bandeaux.etats.${etat}`)}</span></td>
                    <td>{b.langues_incompletes?.length ? <PastilleTraductions langues={b.langues_incompletes} />
                      : <span className={`${gestion.pastille} ${gestion.ok}`}>{t('langues.complet')}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ouvert && (
        <TiroirBandeau key={ouvert === 'nouveau' ? 'nouveau' : ouvert.id} bandeau={ouvert === 'nouveau' ? null : ouvert}
          surFermeture={() => setOuvert(null)}
          surEnregistrement={(b) => { remplacer(b); setOuvert(null); setAnnonce(t('contenus.bandeaux.enregistre')); }}
          surSuppression={(b) => { retirer(b.id); setOuvert(null); setAnnonce(t('contenus.bandeaux.supprime')); }} />
      )}
    </section>
  );
}
