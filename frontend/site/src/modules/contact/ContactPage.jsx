// BF-11 : page Contact (/contact), publique : coordonnées de l'équipe et formulaire.
import Icone from '@partage/ui/Icone.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useCoordonnees } from '@/layout/contenus.js';
import BoutonAppel from '@/modules/appels/composants/BoutonAppel.jsx';

import SectionContact from './composants/SectionContact.jsx';
import styles from './Contact.module.css';

export default function ContactPage() {
  const { t } = useTraduction();
  usePageMeta(t('contact.page.titre'), t('contact.page.description'));
  const { telephones, whatsapp, email } = useCoordonnees();
  return (
    <>
      <div className="conteneur section">
        <h1 className="titre-page">{t('contact.page.titre')}</h1>
        <p className={styles.intro}>{t('contact.page.intro')}</p>
        <div className={styles.coordonnees}>
          {telephones.map((tel) => (
            <a key={tel.lien} href={tel.lien}><Icone nom="tel" taille={18} />&nbsp;{t('pied.telephone', { numero: tel.affichage })}</a>
          ))}
          <a href={whatsapp.lien} target="_blank" rel="noopener noreferrer">
            <Icone nom="message" taille={18} />&nbsp;{t('pied.whatsapp', { numero: whatsapp.affichage })}
          </a>
          {email && <a href={`mailto:${email}`}>{t('pied.email', { email })}</a>}
        </div>
        <BoutonAppel className={styles.appel} />
      </div>
      <SectionContact />
    </>
  );
}
