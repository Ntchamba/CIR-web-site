// BF-06 : ce que le produit apporte (durabilité, beauté, confort), ses caractéristiques et son plan de coupe.
import PlanCoupe from './PlanCoupe.jsx';
import styles from './Produit.module.css';

const APPORTS = [['durabilite', 'Durabilité'], ['beaute', 'Beauté'], ['confort', 'Confort']];
const USAGES = { maison: 'Maison', industrie: 'Industrie', entreprise: 'Entreprise', exterieur: 'Extérieur' };

export default function FicheTechnique({ produit }) {
  return (
    <section id="fiche" className={`conteneur ${styles.fiche}`} aria-labelledby="titre-fiche">
      <div className="entete-section">
        <span className="surtitre">Fiche technique</span>
        <h2 id="titre-fiche">Ce que ce sol vous apporte</h2>
      </div>

      {produit.description && <p className={styles.description}>{produit.description}</p>}

      <div className={styles.apports}>
        {APPORTS.filter(([cle]) => produit[cle]).map(([cle, titre]) => (
          <article key={cle}>
            <h3>{titre}</h3>
            <p>{produit[cle]}</p>
          </article>
        ))}
      </div>

      <dl className={styles.caracteristiques}>
        <div><dt>Pour</dt><dd>{produit.usages.map((u) => USAGES[u]).join(', ') || '—'}</dd></div>
        <div><dt>Famille</dt><dd>{produit.famille}</dd></div>
        {produit.caracteristiques.map((c) => <div key={c.id}><dt>{c.libelle}</dt><dd>{c.valeur}</dd></div>)}
        {produit.mise_en_oeuvre && <div><dt>Mise en œuvre</dt><dd>{produit.mise_en_oeuvre}</dd></div>}
      </dl>

      {produit.couches?.length > 0 && <PlanCoupe couches={produit.couches} />}
    </section>
  );
}
