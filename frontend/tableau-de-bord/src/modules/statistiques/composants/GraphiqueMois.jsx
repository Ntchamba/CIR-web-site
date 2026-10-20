// Graphique en barres par mois, en SVG, sans bibliothèque. Un tableau équivalent, masqué visuellement mais lu par les
// lecteurs d'écran, donne les mêmes valeurs (le SVG est décrit par ce tableau via aria-describedby).
// `series` : [{ cle, libelle, classe, format? }] ; chaque mois : { mois: 'AAAA-MM', [cle]: nombre }.
// Les barres grandissent à l'apparition, sauf si la personne a demandé moins d'animations (voir le CSS).
import { useId } from 'react';

import { date } from '@partage/utils/format.js';

import { localeIntl, useTraduction } from '@/i18n/index.js';

import styles from '../Statistiques.module.css';

const L = 640; const H = 280;
const MARGE = { haut: 20, droite: 12, bas: 44, gauche: 56 };

const moisEnDate = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1));
const moisCourt = (m) => date(moisEnDate(m), { month: 'short', year: '2-digit', timeZone: 'UTC' });
const moisLong = (m) => date(moisEnDate(m), { month: 'long', year: 'numeric', timeZone: 'UTC' });
const compact = (v) => new Intl.NumberFormat(localeIntl(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Pas « rond » (1, 2, 5, 10…) pour au plus quatre intervalles. */
function graduations(max) {
  const brut = Math.max(max, 1) / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * puissance).find((p) => p >= brut);
  const sommet = Math.ceil(max / pas) * pas || pas;
  return { sommet, valeurs: Array.from({ length: Math.round(sommet / pas) + 1 }, (_, i) => i * pas) };
}

export default function GraphiqueMois({ titre, description, mois, series }) {
  const { t } = useTraduction();
  const id = useId();
  const idTitre = `${id}-titre`;
  const idTable = `${id}-table`;
  const valeur = (ligne, cle) => Number(ligne[cle]) || 0;
  const max = Math.max(0, ...mois.flatMap((ligne) => series.map((s) => valeur(ligne, s.cle))));
  const { sommet, valeurs } = graduations(max);
  const largeurUtile = L - MARGE.gauche - MARGE.droite;
  const hauteurUtile = H - MARGE.haut - MARGE.bas;
  const groupe = largeurUtile / mois.length;
  const barre = Math.min(28, (groupe * 0.74) / series.length);
  const y = (v) => MARGE.haut + hauteurUtile - (v / sommet) * hauteurUtile;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.titreBloc}>{titre}</figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} className={styles.graphique} role="img" aria-labelledby={idTitre} aria-describedby={idTable}>
        <title id={idTitre}>{description}</title>
        {valeurs.map((v) => (
          <g key={v}>
            <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(v)} y2={y(v)} className={v === 0 ? styles.axe : styles.grille} />
            <text x={MARGE.gauche - 8} y={y(v) + 4} textAnchor="end" className={styles.etiquette}>{compact(v)}</text>
          </g>
        ))}
        {mois.map((ligne, i) => {
          const x0 = MARGE.gauche + i * groupe + (groupe - barre * series.length) / 2;
          return (
            <g key={ligne.mois}>
              {series.map((s, j) => {
                const v = valeur(ligne, s.cle);
                const h = (v / sommet) * hauteurUtile;
                return h > 0 ? (
                  <rect key={s.cle} x={x0 + j * barre} y={y(v)} width={barre - 2} height={h} rx="2" className={`${styles.barre} ${styles[s.classe]}`} />
                ) : null;
              })}
              <text x={MARGE.gauche + i * groupe + groupe / 2} y={H - MARGE.bas + 18} textAnchor="middle" className={styles.etiquette}>
                {moisCourt(ligne.mois)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className={styles.legende} aria-hidden="true">
        {series.map((s) => (
          <li key={s.cle}><span className={`${styles.pastilleLegende} ${styles[s.classe]}`} />{s.libelle}</li>
        ))}
      </ul>
      <table id={idTable} className="visuellement-cache">
        <caption>{t('statistiques.graphique.tableau', { titre })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('statistiques.graphique.mois')}</th>
            {series.map((s) => <th key={s.cle} scope="col">{s.libelle}</th>)}
          </tr>
        </thead>
        <tbody>
          {mois.map((ligne) => (
            <tr key={ligne.mois}>
              <th scope="row">{moisLong(ligne.mois)}</th>
              {series.map((s) => <td key={s.cle}>{s.format ? s.format(valeur(ligne, s.cle)) : valeur(ligne, s.cle)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
