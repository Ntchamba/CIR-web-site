// Devis liés à une commande (tous, brouillons compris), lien vers l'éditeur et bouton « Créer un devis ».
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import { date, fcfa } from '@partage/utils/format.js';

import { PastilleDevis } from '@/composants/PastilleEtat.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Commandes.module.css';

export default function DevisLies({ commandeId, devis = [], peutCreer }) {
  const { t } = useTraduction();
  return (
    <section className={`carte ${styles.carte}`} aria-labelledby="titre-devis-lies">
      <h2 id="titre-devis-lies" className={styles.titreCarte}>{t('commandes.devis.titre')}</h2>
      {devis.length === 0 ? (
        <p className={styles.vide}>{t('commandes.devis.aucun')}</p>
      ) : (
        <div className={styles.defilement}>
          <table className={styles.tableauSimple}>
            <caption className="visuellement-cache">{t('commandes.devis.legende')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('commandes.devis.reference')}</th>
                <th scope="col">{t('commandes.devis.etat')}</th>
                <th scope="col">{t('commandes.devis.total')}</th>
                <th scope="col">{t('commandes.devis.envoyeLe')}</th>
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/devis/${d.id}`}>{d.reference}</Link></td>
                  <td><PastilleDevis etat={d.etat} expire={d.expire} /></td>
                  <td>{fcfa(d.total)}</td>
                  <td>{d.envoye_le ? date(d.envoye_le) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {peutCreer && (
        <div>
          <Bouton as={Link} to={`/devis/nouveau?commande=${commandeId}`} variante="contour">
            {t('commandes.devis.creer')}
          </Bouton>
        </div>
      )}
    </section>
  );
}
