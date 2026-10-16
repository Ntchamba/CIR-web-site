// Page d'un module pas encore livré : titre et mention « Bientôt disponible ».
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { COORDONNEES } from './coordonnees.js';
import styles from './BientotDisponible.module.css';

export default function BientotDisponible({ titre, texte }) {
  usePageMeta(titre);
  return (
    <div className="conteneur section">
      <h1 className="titre-page">{titre}</h1>
      <div className={styles.carte}>
        <span className={styles.pastille}>Bientôt disponible</span>
        <EtatVide titre="Cette page est en préparation"
          action={<Bouton as="a" href={COORDONNEES.lienTelephone} variante="contour">Appeler le CIR</Bouton>}>
          {texte} En attendant, notre équipe répond par téléphone.
        </EtatVide>
        <Link to="/" className={styles.retour}>Retour à l'accueil</Link>
      </div>
    </div>
  );
}
