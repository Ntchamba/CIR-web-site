// Accueil du tableau de bord : bienvenue, indicateurs des 30 derniers jours et « À traiter » (statistiques/resume/),
// puis accès rapides. Si les statistiques ne se chargent pas, l'accueil reste celui d'avant (bienvenue et raccourcis).
import { Link } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import useChargement from '@/composants/useChargement.js';
import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';
import { resumeStatistiques } from '@/modules/statistiques/api.js';
import ATraiter from '@/modules/statistiques/composants/ATraiter.jsx';
import CartesIndicateurs from '@/modules/statistiques/composants/CartesIndicateurs.jsx';

import IconeMenu from './IconeMenu.jsx';
import { modulesVisibles } from './menu.js';
import styles from './Pages.module.css';

export default function AccueilPage() {
  const { t } = useTraduction();
  usePageMeta(t('modules.accueil.libelle'));
  const { utilisateur, superAdmin } = useAuth();
  const prenom = String(utilisateur?.nom_complet || '').trim().split(/\s+/)[0];
  const stats = useChargement((signal) => resumeStatistiques({}, { signal }), []);
  // Réponse inattendue ou erreur : on n'affiche rien (aucune valeur inventée).
  const resume = stats.donnees?.commandes && stats.donnees?.a_traiter ? stats.donnees : null;
  const raccourcis = modulesVisibles(superAdmin).filter((m) => m.chemin !== '/');

  return (
    <div className={styles.page}>
      <h1 className="titre-page">{prenom ? t('accueil.bonjourNom', { prenom }) : t('accueil.bonjour')}</h1>
      <p className="sous-titre-page">
        {t('accueil.intro')}
      </p>
      {resume && (
        <section className={styles.apercu} aria-labelledby="accueil-apercu">
          <h2 id="accueil-apercu" className={styles.titreApercu}>{t('accueil.apercu')}</h2>
          <CartesIndicateurs resume={resume} titre={t('accueil.apercu')} />
          <ATraiter donnees={resume.a_traiter} masquerZeros idTitre="accueil-a-traiter" titre={t('statistiques.aTraiter.titre')} />
          <p><Link to="/statistiques">{t('accueil.voirStatistiques')}</Link></p>
        </section>
      )}
      <ul className={styles.raccourcis}>
        {raccourcis.map((m) => (
          <li key={m.chemin}>
            <Link to={m.chemin} className={styles.raccourci}>
              <IconeMenu nom={m.icone} taille={24} />
              <span>{m.libelle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
