// Choix du design et contact. En attendant la sélection et la commande en ligne (vague 2) :
// boutons « Appeler » et « WhatsApp » (message prérempli avec le produit et le design choisis).
// Rendu avec key={slug} : le design choisi est oublié en changeant de produit.
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';
import { prix } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import { lienWhatsApp } from '@/layout/coordonnees.js';
import { useCoordonnees } from '@/layout/contenus.js';

import styles from '../Produit.module.css';

export default function PanneauOptions({ produit }) {
  const { t } = useTraduction();
  const { telephone, whatsapp } = useCoordonnees();
  const designs = produit.designs || [];
  const [choix, setChoix] = useState(null);

  const design = designs.find((d) => d.id === choix) || null;
  const nomProduit = [produit.reference, produit.nom].filter(Boolean).join(' ');
  const message = design
    ? t('produit.options.messageDesign', { produit: nomProduit, design: design.nom })
    : t('produit.options.message', { produit: nomProduit });

  return (
    <div className={styles.panneau}>
      <p className={styles.prix}>{prix(produit.prix, produit.unite_prix)}</p>

      {designs.length > 0 && (
        <fieldset className={styles.designs}>
          <legend>{t('produit.options.designs')}</legend>
          <div className={styles.pastillesDesign}>
            {designs.map((d) => (
              <label key={d.id} className={styles.design} title={d.nom}>
                <input type="radio" name={`design-${produit.slug}`} value={d.id} checked={choix === d.id}
                  onChange={() => setChoix(d.id)} className="visuellement-cache" />
                <span className={styles.echantillon} aria-hidden="true"
                  style={d.image?.url ? undefined : { background: d.couleur || 'var(--fond-2)' }}>
                  {d.image?.url && <img src={d.image.url} alt="" width="56" height="56" loading="lazy" decoding="async" />}
                </span>
                <span className={styles.nomDesign}>{d.nom}</span>
              </label>
            ))}
          </div>
          <p className={styles.designChoisi} aria-live="polite">
            {design ? t('produit.options.designChoisi', { nom: design.nom }) : ''}
          </p>
        </fieldset>
      )}

      <div className={styles.contact}>
        <p>{t('produit.options.contact')}</p>
        <Bouton as="a" href={telephone.lien} taille="large">
          <Icone nom="tel" taille={18} />
          {t('produit.options.appeler')}
        </Bouton>
        <Bouton as="a" href={lienWhatsApp(whatsapp.affichage, message)} variante="contour" taille="large"
          target="_blank" rel="noopener noreferrer">
          <Icone nom="message" taille={18} />
          {t('produit.options.whatsapp')}
        </Bouton>
        <p className={styles.note}>{t('produit.options.commandeBientot')}</p>
      </div>
    </div>
  );
}
