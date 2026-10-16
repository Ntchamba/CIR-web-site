// BF-07 : détail d'une actualité (date, image, texte, produit lié).
import { Link, useParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import Paragraphes from '@/composants/Paragraphes.jsx';
import { useTraduction } from '@/i18n/index.js';

import { useActualite } from './useActualites.js';
import styles from './Actualites.module.css';

export default function ActualitePage() {
  const { slug } = useParams();
  const { t } = useTraduction();
  const { actualite, chargement, erreur, introuvable, recharger } = useActualite(slug);
  usePageMeta(actualite?.titre || (introuvable ? t('actualites.introuvable.titre') : t('actualites.titre')), actualite?.resume);

  if (introuvable) {
    return (
      <div className="conteneur section">
        <EtatVide titre={t('actualites.introuvable.titre')} niveau={1}
          action={<Bouton as={Link} to="/actualites">{t('actualites.retour')}</Bouton>}>
          {t('actualites.introuvable.texte')}
        </EtatVide>
      </div>
    );
  }
  if (!actualite) {
    return (
      <div className="conteneur section">
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  return (
    <article className={`conteneur section ${styles.article}`}>
      <Link to="/actualites" className={styles.retour}><Icone nom="retour" taille={18} />{t('actualites.retour')}</Link>
      <header className={styles.enteteArticle}>
        <time dateTime={actualite.publie_le} className={styles.date}>
          {t('actualites.publieLe', { date: date(actualite.publie_le) })}
        </time>
        <h1 className={styles.titreArticle}>{actualite.titre}</h1>
        {actualite.resume && <p className={styles.chapo}>{actualite.resume}</p>}
      </header>
      {actualite.image?.url && (
        <ImageMedia image={actualite.image} largeur={1280} hauteur={720} prioritaire className={styles.imageArticle} />
      )}
      <Paragraphes texte={actualite.texte} className={styles.texte} />
      {actualite.produit?.slug && (
        <aside className={styles.produitLie}>
          <span>{t('actualites.produitLie')}</span>
          <Link to={`/catalogue/${actualite.produit.slug}`}>
            {actualite.produit.nom}
            <Icone nom="fleche" taille={18} />
          </Link>
        </aside>
      )}
    </article>
  );
}
