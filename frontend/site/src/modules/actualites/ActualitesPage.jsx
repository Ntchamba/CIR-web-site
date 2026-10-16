// BF-07 : liste des actualités (nouveaux produits, chantiers, annonces), « Voir plus ».
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import VoirPlus from '@/composants/VoirPlus.jsx';
import { useTraduction } from '@/i18n/index.js';

import CarteActualite from './composants/CarteActualite.jsx';
import useActualites from './useActualites.js';
import styles from './Actualites.module.css';

export default function ActualitesPage() {
  const { t } = useTraduction();
  usePageMeta(t('actualites.titre'), t('actualites.description'));
  const liste = useActualites();

  return (
    <div className="conteneur section">
      <header className={styles.entete}>
        <h1 className="titre-page">{t('actualites.titre')}</h1>
        <p className={styles.intro}>{t('actualites.intro')}</p>
      </header>
      {liste.chargement && !liste.elements.length && <Chargement />}
      <MessageErreur erreur={liste.erreur} reessayer={liste.recharger} />
      {!liste.chargement && !liste.erreur && !liste.elements.length && (
        <EtatVide titre={t('actualites.vide.titre')}>{t('actualites.vide.texte')}</EtatVide>
      )}
      {liste.elements.length > 0 && (
        <ul className={styles.grille}>
          {liste.elements.map((a) => <li key={a.id}><CarteActualite actualite={a} /></li>)}
        </ul>
      )}
      <VoirPlus liste={liste} />
    </div>
  );
}
