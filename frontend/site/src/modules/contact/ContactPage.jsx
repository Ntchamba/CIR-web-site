// BF-11 : page Contact (/contact), publique : la section Contact de la maquette (coordonnées, WhatsApp, formulaire),
// avec l'appel de l'équipe (fonction absente de la maquette) sous les boutons.
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useCoordonnees } from '@/layout/contenus.js';
import BoutonAppel from '@/modules/appels/composants/BoutonAppel.jsx';

import SectionContact from './composants/SectionContact.jsx';
import styles from './Contact.module.css';

export default function ContactPage() {
  const { t } = useTraduction();
  usePageMeta(t('contact.page.titre'), t('contact.page.description'));
  const { email } = useCoordonnees();
  return (
    <SectionContact niveau={1} className={styles.pageContact} id="contact-page"
      enfants={(
        <div className={styles.appelContact}>
          {email && <p><a href={`mailto:${email}`}>{t('pied.email', { email })}</a></p>}
          <BoutonAppel className={styles.appel} />
        </div>
      )} />
  );
}
