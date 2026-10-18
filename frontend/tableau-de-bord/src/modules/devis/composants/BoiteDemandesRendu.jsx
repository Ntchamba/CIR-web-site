// Onglet « Demandes de rendu » : boîte de réception des demandes des clients ; un clic ouvre le détail dans un tiroir.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, surface } from '@partage/utils/format.js';

import PastilleEtat from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { useTraduction } from '@/i18n/index.js';

import TiroirDemandeRendu from './TiroirDemandeRendu.jsx';

const TONS = { nouvelle: 'alerte', en_etude: 'attention', devis_envoye: 'info', close: 'neutre' };
const resumeTexte = (texte = '') => (texte.length > 90 ? `${texte.slice(0, 90)}…` : texte);

export default function BoiteDemandesRendu({ liste, filtre, effacer, apresModification }) {
  const { t } = useTraduction();
  const { elements, total, chargement, erreur, recharger, remplacer } = liste;
  const [ouverte, setOuverte] = useState(null);

  return (
    <>
      {chargement ? (
        <Chargement texte={t('devis.demandes.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : elements.length === 0 ? (
        <EtatVide titre={filtre ? t('devis.demandes.aucunFiltre') : t('devis.demandes.aucune')}
          action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('devis.effacer')}</Bouton> : null}>
          {filtre ? t('devis.demandes.aucunFiltreTexte') : t('devis.demandes.aucuneTexte')}
        </EtatVide>
      ) : (
        <>
          <p className={gestion.compte} aria-live="polite">{t('devis.demandes.nombre', { n: total })}</p>
          <div className={`carte ${gestion.tableau}`}>
            <table>
              <caption className="visuellement-cache">{t('devis.demandes.legende')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('devis.demandes.colonnes.demande')}</th>
                  <th scope="col">{t('devis.demandes.colonnes.client')}</th>
                  <th scope="col">{t('devis.demandes.colonnes.type')}</th>
                  <th scope="col">{t('devis.demandes.colonnes.etat')}</th>
                  <th scope="col">{t('devis.demandes.colonnes.recue')}</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <button type="button" className={gestion.nom} onClick={() => setOuverte(d)}>{d.reference}</button>
                      <span className={gestion.secondaire}>{resumeTexte(d.description)}</span>
                    </td>
                    <td>{d.client?.nom_complet || '—'}</td>
                    <td>
                      {t(`commandes.types.${d.type_batiment}`)}
                      {d.surface_m2 != null && <span className={gestion.secondaire}>{surface(d.surface_m2)}</span>}
                    </td>
                    <td><PastilleEtat ton={TONS[d.etat] || 'neutre'}>{t(`devis.demandes.etats.${d.etat}`)}</PastilleEtat></td>
                    <td>{date(d.cree_le)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {ouverte && (
        <TiroirDemandeRendu id={ouverte.id} reference={ouverte.reference} surFermeture={() => setOuverte(null)}
          surMiseAJour={(maj) => { remplacer({ id: maj.id ?? ouverte.id, etat: maj.etat }); apresModification?.(); }} />
      )}
    </>
  );
}
