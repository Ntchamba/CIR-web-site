// Accueil : les trois dernières actualités, avec un lien vers toutes. Rien n'est affiché sans actualité publiée.
import EnteteSection from '@/composants/EnteteSection.jsx';
import { useTraduction } from '@/i18n/index.js';

import { useDernieresActualites } from '../useActualites.js';
import styles from '../Actualites.module.css';
import CarteActualite from './CarteActualite.jsx';

export default function SectionActualites() {
  const { t } = useTraduction();
  const { actualites } = useDernieresActualites(3);
  if (!actualites.length) return null;
  return (
    <section className="salle" aria-labelledby="titre-actualites-accueil">
      <div className="conteneur">
        <EnteteSection id="titre-actualites-accueil" surtitre={t('actualites.surtitre')} titre={t('actualites.accueil.titre')}
          lien="/actualites" texteLien={t('actualites.accueil.toutes')} />
        <ul className={styles.grille}>
          {actualites.map((a) => <li key={a.id} className="p3d"><CarteActualite actualite={a} niveauTitre={3} /></li>)}
        </ul>
      </div>
    </section>
  );
}
