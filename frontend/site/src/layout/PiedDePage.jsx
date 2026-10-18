// Pied de page : marque, plan du site, coordonnées, choix de la langue et partenaire fabricant Jiuye.
import { Link } from 'react-router';

import ChoixLangue from '@partage/ui/ChoixLangue.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { useCoordonnees } from './contenus.js';
import styles from './PiedDePage.module.css';

export default function PiedDePage() {
  const { t } = useTraduction();
  const { retenirLangue } = useAuth();
  const coordonnees = useCoordonnees();
  return (
    <footer className={styles.pied}>
      <div className={`conteneur ${styles.grille}`}>
        <div className={styles.marque}>
          <img src="/media/marque/logo-cir.webp" alt="" width="44" height="44" loading="lazy" />
          <div>
            <strong>{t('marque.raisonSociale')}</strong>
            <p>{t('marque.accroche')}</p>
          </div>
        </div>

        <nav aria-label={t('nav.planDuSite')} className={styles.colonne}>
          <h2 className={styles.etiquette}>{t('pied.navigation')}</h2>
          <Link to="/">{t('nav.accueil')}</Link>
          <Link to="/catalogue">{t('nav.catalogue')}</Link>
          <Link to="/realisations">{t('nav.realisations')}</Link>
          <Link to="/actualites">{t('nav.actualites')}</Link>
          <Link to="/commandes">{t('nav.mesCommandes')}</Link>
          <Link to="/contact">{t('nav.contact')}</Link>
        </nav>

        <div className={styles.colonne}>
          <h2 className={styles.etiquette}>{t('pied.contact')}</h2>
          <address className={styles.adresse}>
            <span>{coordonnees.adresse}</span>
            {/* La ville n'est ajoutée que si l'adresse ne la contient pas déjà. */}
            {!/douala/i.test(coordonnees.adresse) && <span>{t('marque.ville')}</span>}
          </address>
          {coordonnees.telephones.map((tel) => (
            <a key={tel.lien} href={tel.lien}>{t('pied.telephone', { numero: tel.affichage })}</a>
          ))}
          <a href={coordonnees.whatsapp.lien} target="_blank" rel="noopener noreferrer">
            {t('pied.whatsapp', { numero: coordonnees.whatsapp.affichage })}
          </a>
          {coordonnees.email && (
            <a href={`mailto:${coordonnees.email}`}>{t('pied.email', { email: coordonnees.email })}</a>
          )}
        </div>

        <div className={styles.partenaire}>
          <h2 className={styles.etiquette}>{t('pied.partenaire')}</h2>
          <img src="/media/marque/logo-jiuye.webp" alt="Jiuye" width="64" height="100" loading="lazy" />
          <p>{t('pied.partenaireTexte')}</p>
        </div>
      </div>
      <div className={`conteneur ${styles.bas}`}>
        <span>{t('pied.droits', { annee: String(new Date().getFullYear()) })}</span>
        <ChoixLangue surChangement={retenirLangue} />
      </div>
    </footer>
  );
}
