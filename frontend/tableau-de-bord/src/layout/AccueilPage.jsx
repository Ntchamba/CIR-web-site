// Accueil du tableau de bord : bienvenue et accès rapides. Les statistiques arrivent en vague 4
// (module statistiques, TableauDeBordPage.jsx), qui remplacera cette page.
import { Link } from 'react-router';

import usePageMeta from '@partage/utils/usePageMeta.js';

import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import IconeMenu from './IconeMenu.jsx';
import { modulesVisibles } from './menu.js';
import styles from './Pages.module.css';

export default function AccueilPage() {
  usePageMeta('Accueil');
  const { utilisateur, superAdmin } = useAuth();
  const prenom = String(utilisateur?.nom_complet || '').trim().split(/\s+/)[0];
  const raccourcis = modulesVisibles(superAdmin).filter((m) => m.chemin !== '/');

  return (
    <div className={styles.page}>
      <h1 className="titre-page">Bonjour{prenom ? ` ${prenom}` : ''}</h1>
      <p className="sous-titre-page">
        Bienvenue sur le tableau de bord du CIR. Les statistiques des commandes et des ventes arriveront ici prochainement.
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
