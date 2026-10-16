// BF-14 : fiche technique (présentation, domaine d'application, performances, mise en œuvre,
// tableau des indicateurs). Seules les rubriques renseignées par l'équipe sont affichées.
import Paragraphes from '@/composants/Paragraphes.jsx';
import { useTraduction } from '@/i18n/index.js';

import styles from '../Produit.module.css';

const ETAPES = ['preparation', 'methode_application', 'dosage', 'conditions_chantier'];

export default function FicheTechnique({ produit }) {
  const { t } = useTraduction();
  const miseEnOeuvre = produit.mise_en_oeuvre || {};
  const etapes = ETAPES.filter((cle) => miseEnOeuvre[cle]);
  const caracteristiques = produit.caracteristiques || [];
  const rubriques = [
    ['presentation', produit.description],
    ['domaine', produit.domaine_application],
    ['performances', produit.performances],
  ].filter(([, texte]) => texte);

  if (!rubriques.length && !etapes.length && !caracteristiques.length) return null;

  return (
    <section className={styles.fiche} aria-labelledby="titre-fiche">
      <h2 id="titre-fiche">{t('produit.fiche.titre')}</h2>
      {rubriques.map(([cle, texte]) => (
        <div key={cle} className={styles.rubrique}>
          <h3>{t(`produit.fiche.${cle}`)}</h3>
          <Paragraphes texte={texte} className={styles.texte} />
        </div>
      ))}
      {etapes.length > 0 && (
        <div className={styles.rubrique}>
          <h3>{t('produit.fiche.miseEnOeuvre')}</h3>
          <dl className={styles.etapes}>
            {etapes.map((cle) => (
              <div key={cle}>
                <dt>{t(`produit.fiche.etapes.${cle}`)}</dt>
                <dd><Paragraphes texte={miseEnOeuvre[cle]} /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {caracteristiques.length > 0 && (
        <div className={styles.rubrique}>
          <div className={styles.defilementTableau}>
            <table className={styles.tableau}>
              <caption>{t('produit.fiche.indicateurs')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('produit.fiche.indicateur')}</th>
                  <th scope="col">{t('produit.fiche.valeur')}</th>
                </tr>
              </thead>
              <tbody>
                {caracteristiques.map((c, i) => (
                  <tr key={`${c.libelle}-${i}`}>
                    <th scope="row">{c.libelle}</th>
                    <td>{c.valeur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
