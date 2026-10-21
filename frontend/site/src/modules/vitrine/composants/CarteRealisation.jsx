// Carte d'une réalisation : avant / après (ou photo du résultat), titre, lieu, type, date, produits utilisés.
import { Link } from 'react-router';

import { date } from '@partage/utils/format.js';

import ImageMedia from '@/composants/ImageMedia.jsx';
import Paragraphes from '@/composants/Paragraphes.jsx';
import { useTraduction } from '@/i18n/index.js';
import { estUsage } from '@/modules/catalogue/usages.js';

import styles from '../Vitrine.module.css';
import AvantApres from './AvantApres.jsx';

/** Produits en liens, séparés selon la langue (« a, b, c » ; « a、b、c » en chinois et en japonais). */
function ListeProduits({ produits, locale }) {
  let morceaux;
  try {
    morceaux = new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).formatToParts(produits.map((p) => p.slug));
  } catch {
    morceaux = produits.flatMap((p, i) => (i ? [{ type: 'literal', value: ', ' }, { type: 'element' }] : [{ type: 'element' }]));
  }
  let n = 0;
  return morceaux.map((m, i) => {
    if (m.type !== 'element') return <span key={i}>{m.value}</span>;
    const p = produits[n++];
    return <Link key={i} to={`/catalogue/${p.slug}`}>{p.nom}</Link>;
  });
}

export default function CarteRealisation({ realisation, niveauTitre = 3, resume = false }) {
  const { t, locale } = useTraduction();
  const Titre = `h${niveauTitre}`;
  const r = realisation;
  const details = [
    estUsage(r.type_chantier) ? t(`usages.${r.type_chantier}`) : null,
    r.ville,
    r.date ? date(r.date, { month: 'long', year: 'numeric' }) : null,
  ].filter(Boolean);
  return (
    <article className="m-carte-chantier">
      <div className="img">
        {r.image_avant?.url && r.image_apres?.url
          ? <AvantApres avant={r.image_avant} apres={r.image_apres} titre={r.titre} />
          : <ImageMedia image={r.image_apres} alt={r.image_apres?.alt || r.titre} largeur={1280} hauteur={960} />}
      </div>
      <Titre>{r.titre}</Titre>
      {details.length > 0 && <p>{details.join(' · ')}</p>}
      {!resume && <Paragraphes texte={r.description} className={styles.description} />}
      {!resume && r.produits?.length > 0 && (
        <p className={styles.produits}>
          <span>{t('vitrine.realisations.produits')}</span>{' '}
          <ListeProduits produits={r.produits} locale={locale} />
        </p>
      )}
    </article>
  );
}
