// Page d'un module pas encore livré : titre et mention « Bientôt disponible ».
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import styles from './Pages.module.css';

export default function BientotDisponible({ titre, texte }) {
  usePageMeta(titre);
  return (
    <div className={styles.page}>
      <h1 className="titre-page">{titre}</h1>
      <div className={`carte ${styles.bientot}`}>
        <span className={styles.pastille}>Bientôt disponible</span>
        <EtatVide titre="Ce module est en préparation"
          action={<Bouton as={Link} to="/" variante="contour">Retour à l'accueil</Bouton>}>
          {texte}
        </EtatVide>
      </div>
    </div>
  );
}
