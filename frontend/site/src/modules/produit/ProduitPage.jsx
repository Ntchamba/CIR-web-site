// BF-01, BF-05, BF-06, BF-14 : fiche d'un produit (galerie, designs, contact, fiche technique, plan de coupe).
import { Link, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useContexteAssistant } from '@/modules/assistant/contexte.js';
import { estUsage } from '@/modules/catalogue/usages.js';

import FicheTechnique from './composants/FicheTechnique.jsx';
import Galerie from './composants/Galerie.jsx';
import PanneauOptions from './composants/PanneauOptions.jsx';
import PlanCoupe from './composants/PlanCoupe.jsx';
import useProduit from './useProduit.js';
import styles from './Produit.module.css';

export default function ProduitPage() {
  const { slug } = useParams();
  const { t } = useTraduction();
  const { produit, chargement, erreur, introuvable, recharger } = useProduit(slug);
  usePageMeta(produit?.nom || (introuvable ? t('produit.introuvable.titre') : t('catalogue.titre')), produit?.accroche);
  useContexteAssistant('produit', produit?.reference); // contexte transmis à l'assistant (indice vérifié par le serveur)

  if (introuvable) {
    return (
      <div className="conteneur section">
        <EtatVide titre={t('produit.introuvable.titre')} niveau={1}
          action={<Bouton as={Link} to="/catalogue">{t('produit.retourCatalogue')}</Bouton>}>
          {t('produit.introuvable.texte')}
        </EtatVide>
      </div>
    );
  }
  if (!produit) {
    return (
      <div className="conteneur section">
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  const usages = (produit.usages || []).filter(estUsage);
  return (
    <div className="conteneur section">
      <nav aria-label={t('produit.filAriane')} className={styles.ariane}>
        <Link to="/catalogue"><Icone nom="retour" taille={18} />{t('produit.retourCatalogue')}</Link>
        {produit.famille?.slug && (
          <Link to={`/catalogue?famille=${encodeURIComponent(produit.famille.slug)}`}>{produit.famille.nom}</Link>
        )}
      </nav>

      <div className={styles.haut}>
        <Galerie key={produit.slug} images={produit.images || (produit.image ? [produit.image] : [])} nom={produit.nom} reference={produit.reference} />
        <div className={styles.resume}>
          <div className={styles.pastilles}>
            {produit.reference && <span className={styles.reference}>{produit.reference}</span>}
            {produit.est_nouveau && <span className={styles.nouveau}>{t('catalogue.carte.nouveau')}</span>}
          </div>
          <h1 className={styles.titre}>{produit.nom}</h1>
          {produit.accroche && <p className={styles.accroche}>{produit.accroche}</p>}
          {usages.length > 0 && (
            <ul className={styles.usages} aria-label={t('catalogue.carte.usages')}>
              {usages.map((u) => <li key={u}>{t(`usages.${u}`)}</li>)}
            </ul>
          )}
          <PanneauOptions key={produit.slug} produit={produit} />
        </div>
      </div>

      <div className={styles.bas}>
        <FicheTechnique produit={produit} />
        <PlanCoupe couches={produit.couches} />
      </div>
    </div>
  );
}
