// Onglet « Devis » : liste des devis (référence, commande liée, état, total, envoi).
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa } from '@partage/utils/format.js';

import { PastilleDevis } from '@/composants/PastilleEtat.jsx';
import gestion from '@/composants/Gestion.module.css';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Devis.module.css';

export default function ListeDevis({ liste, filtre, effacer }) {
  const { t } = useTraduction();
  const { elements, total, chargement, erreur, recharger } = liste;
  if (chargement) return <Chargement texte={t('devis.liste.chargement')} />;
  if (erreur) return <MessageErreur erreur={erreur} reessayer={recharger} />;
  if (elements.length === 0) {
    return (
      <EtatVide titre={filtre ? t('devis.liste.aucunFiltre') : t('devis.liste.aucun')}
        action={filtre ? <Bouton variante="contour" onClick={effacer}>{t('devis.effacer')}</Bouton> : null}>
        {filtre ? t('devis.liste.aucunFiltreTexte') : t('devis.liste.aucunTexte')}
      </EtatVide>
    );
  }
  return (
    <>
      <p className={gestion.compte} aria-live="polite">{t('devis.liste.nombre', { n: total })}</p>
      <div className={`carte ${gestion.tableau}`}>
        <table>
          <caption className="visuellement-cache">{t('devis.liste.legende')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('devis.liste.colonnes.reference')}</th>
              <th scope="col">{t('devis.liste.colonnes.commande')}</th>
              <th scope="col">{t('devis.liste.colonnes.etat')}</th>
              <th scope="col">{t('devis.liste.colonnes.total')}</th>
              <th scope="col">{t('devis.liste.colonnes.envoye')}</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((d) => (
              <tr key={d.id}>
                <td><Link to={`/devis/${d.id}`} className={styles.reference}>{d.reference}</Link></td>
                <td>
                  {d.commande_reference
                    ? <Link to={`/commandes/${typeof d.commande === 'object' ? d.commande?.id : d.commande}`}>{d.commande_reference}</Link>
                    : '—'}
                </td>
                <td><PastilleDevis etat={d.etat} expire={d.expire} /></td>
                <td>{fcfa(d.total)}</td>
                <td>{d.envoye_le ? date(d.envoye_le) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
