// Pied de page : marque, liens, coordonnées et logo du partenaire fabricant Jiuye.
import { Link } from 'react-router-dom';

import useCoordonnees from '@/hooks/useCoordonnees.js';
import { lienWhatsApp } from '@/modules/accueil/api.js';

import styles from './PiedDePage.module.css';

export default function PiedDePage() {
  const c = useCoordonnees();
  return (
    <footer className={styles.pied}>
      <div className={`conteneur ${styles.grille}`}>
        <div className={styles.marque}>
          <img src="/media/marque/logo-cir.webp" alt="" width="44" height="44" loading="lazy" />
          <div>
            <strong>Complexe Industriel Révélation SARL</strong>
            <p>Revêtements de sol en résine époxy pour la maison, l'industrie et l'entreprise.</p>
          </div>
        </div>

        <nav aria-label="Plan du site" className={styles.colonne}>
          <span className="etiquette">Navigation</span>
          <Link to="/">Accueil</Link>
          <Link to="/catalogue">Catalogue</Link>
          <Link to="/realisations">Réalisations</Link>
          <Link to="/commandes">Mes commandes</Link>
        </nav>

        <div className={styles.colonne}>
          <span className="etiquette">Contact</span>
          <span>{c.adresse}</span>
          <span>Téléphone : {c.telephone}</span>
          <a href={lienWhatsApp(c.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp : {c.whatsapp}</a>
          <Link to="/#contact">Écrire à l'équipe</Link>
        </div>

        <div className={styles.partenaire}>
          <span className="etiquette">Partenaire fabricant</span>
          <img src="/media/marque/logo-jiuye.webp" alt="Jiuye" width="64" height="100" loading="lazy" />
        </div>
      </div>
      <div className={`conteneur ${styles.bas}`}>
        <span>© {new Date().getFullYear()} Complexe Industriel Révélation SARL, Douala</span>
      </div>
    </footer>
  );
}
