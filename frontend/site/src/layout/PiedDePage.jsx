// Pied de page de la maquette : sombre sur ordinateur, blanc sur téléphone ; logo et raison sociale, coordonnées,
// liens, partenaire Jiuye (nom propre), mention de droits. Le choix de la langue (absent de la maquette) reste en bas.
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
  // « Total Nkolmbong, Douala, Cameroun » : le pays n'est ajouté que si l'adresse ne le contient pas déjà.
  const adresse = /cameroun|cameroon|kamerun|喀麦隆|カメルーン/i.test(coordonnees.adresse)
    ? coordonnees.adresse
    : `${coordonnees.adresse}, ${t('marque.pays')}`;
  return (
    <footer className={styles.pied} data-pied>
      <div className={`m-conteneur ${styles.colonnes}`}>
        <div className={styles.marque}>
          <div className={styles.raison}>
            <img src="/media/marque/logo-cir.webp" alt="" width="56" height="56" loading="lazy" />
            <span>{t("marque.raisonSociale")}</span>
          </div>
          <p className={styles.coordonnees}>
            {adresse}<br />
            {t('pied.telephone', { numero: coordonnees.telephones.map((x) => x.affichage).join(' · ') })}<br />
            {t('pied.whatsapp', { numero: coordonnees.whatsapp.affichage })}
            {coordonnees.email && <><br /><a href={`mailto:${coordonnees.email}`}>{t('pied.email', { email: coordonnees.email })}</a></>}
          </p>
        </div>

        <nav aria-label={t('nav.planDuSite')} className={styles.liens}>
          <b>{t('pied.navigation')}</b>
          <Link to="/">{t('nav.accueil')}</Link>
          <Link to="/catalogue">{t('nav.catalogue')}</Link>
          <Link to="/realisations">{t('nav.realisations')}</Link>
          <Link to="/contact">{t('nav.contact')}</Link>
          <Link to="/commandes">{t('nav.mesCommandes')}</Link>
          <Link to="/actualites" className={styles.discret}>{t('nav.actualites')}</Link>
        </nav>

        <div className={styles.partenaire}>
          <b>{t('pied.partenaire')}</b>
          <div className={styles.jiuye}>
            <img src="/media/marque/logo-jiuye.webp" alt="Jiuye" width="54" height="84" loading="lazy" />
            <span>{t('pied.jiuye')}</span>
          </div>
        </div>
      </div>
      <div className={`m-conteneur ${styles.bas}`}>
        <span>{t('pied.droits', { annee: String(new Date().getFullYear()) })}</span>
        <ChoixLangue className={styles.langue} surChangement={retenirLangue} />
      </div>
    </footer>
  );
}
