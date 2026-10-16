// Accueil du tableau de bord : bienvenue et accès rapides. Les statistiques arrivent en vague 4
// (module statistiques, TableauDeBordPage.jsx), qui remplacera cette page.
import { Link } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import IconeMenu from './IconeMenu.jsx';
import { modulesVisibles } from './menu.js';
import styles from './Pages.module.css';

export default function AccueilPage() {
  const { t } = useTraduction();
  usePageMeta(t('modules.accueil.libelle'));
  const { utilisateur, superAdmin } = useAuth();
  const prenom = String(utilisateur?.nom_complet || '').trim().split(/\s+/)[0];
  const raccourcis = modulesVisibles(superAdmin).filter((m) => m.chemin !== '/');

  return (
    <div className={styles.page}>
      <h1 className="titre-page">{prenom ? t('accueil.bonjourNom', { prenom }) : t('accueil.bonjour')}</h1>
      <p className="sous-titre-page">
        {t('accueil.intro')}
      </p>
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
