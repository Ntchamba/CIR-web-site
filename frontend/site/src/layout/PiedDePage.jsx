// Pied de page : marque, plan du site, coordonnées et partenaire fabricant Jiuye.
import { Link } from 'react-router';

import { COORDONNEES, TELEPHONES } from './coordonnees.js';
import styles from './PiedDePage.module.css';

export default function PiedDePage() {
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
          <h2 className={styles.etiquette}>Navigation</h2>
          <Link to="/">Accueil</Link>
          <Link to="/catalogue">Catalogue</Link>
          <Link to="/realisations">Réalisations</Link>
          <Link to="/commandes">Mes commandes</Link>
        </nav>

        <div className={styles.colonne}>
          <h2 className={styles.etiquette}>Contact</h2>
          <span>{COORDONNEES.ville}</span>
          {TELEPHONES.map((t) => <a key={t.lien} href={t.lien}>Téléphone : {t.affichage}</a>)}
        </div>

        <div className={styles.partenaire}>
          <h2 className={styles.etiquette}>Partenaire fabricant</h2>
          <img src="/media/marque/logo-jiuye.webp" alt="Jiuye" width="64" height="100" loading="lazy" />
          <p>Nos résines sont fabriquées par notre partenaire Jiuye.</p>
        </div>
      </div>
      <div className={`conteneur ${styles.bas}`}>
        <span>© {new Date().getFullYear()} Complexe Industriel Révélation SARL, Douala</span>
      </div>
    </footer>
  );
}
