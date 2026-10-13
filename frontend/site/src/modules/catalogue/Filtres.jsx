// Barre de filtres légère : type de bâtiment, famille, recherche.
import { useEffect, useState } from 'react';

import styles from './Catalogue.module.css';

const USAGES = [['', 'Tous les sols'], ['maison', 'Maison'], ['industrie', 'Industrie'], ['entreprise', 'Entreprise'],
  ['exterieur', 'Extérieur']];

export default function Filtres({ familles, valeurs, onChange }) {
  const [texte, setTexte] = useState(valeurs.recherche);
  useEffect(() => {
    const minuteur = setTimeout(() => texte !== valeurs.recherche && onChange('q', texte.trim()), 350);
    return () => clearTimeout(minuteur);
  }, [texte]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={styles.filtres} aria-label="Filtres du catalogue">
      <label className={styles.recherche}>
        <span className="visuellement-cache">Rechercher un produit</span>
        <input type="search" placeholder="Rechercher…" value={texte} onChange={(e) => setTexte(e.target.value)} />
      </label>

      <div className={styles.groupe} role="group" aria-labelledby="filtre-usage">
        <span id="filtre-usage" className="etiquette">Pour quel sol ?</span>
        {USAGES.map(([valeur, libelle]) => (
          <button key={valeur || 'tous'} type="button" aria-pressed={valeurs.usage === valeur}
            className={valeurs.usage === valeur ? styles.choisi : ''} onClick={() => onChange('usage', valeur)}>
            {libelle}
          </button>
        ))}
      </div>

      <div className={styles.groupe} role="group" aria-labelledby="filtre-famille">
        <span id="filtre-famille" className="etiquette">Famille</span>
        <button type="button" aria-pressed={!valeurs.famille} className={!valeurs.famille ? styles.choisi : ''}
          onClick={() => onChange('famille', '')}>
          Toutes les familles
        </button>
        {familles.filter((f) => f.nb_produits > 0).map((f) => (
          <button key={f.slug} type="button" aria-pressed={valeurs.famille === f.slug}
            className={valeurs.famille === f.slug ? styles.choisi : ''} onClick={() => onChange('famille', f.slug)}>
            {f.nom}
          </button>
        ))}
      </div>
    </aside>
  );
}
