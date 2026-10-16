// Filtres du catalogue : famille (liste), usage (boutons), recherche. Les critères vivent dans l'adresse.
import { useEffect, useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';

import { useTraduction } from '@/i18n/index.js';

import { USAGES } from '../usages.js';
import styles from '../Catalogue.module.css';

export default function Filtres({ criteres, familles = [], changerCriteres, effacerCriteres }) {
  const { t } = useTraduction();
  const idUsages = useId();
  const [recherche, setRecherche] = useState(criteres.q);

  // L'adresse peut changer sans ce formulaire (bouton « Précédent », lien) : la saisie suit.
  useEffect(() => setRecherche(criteres.q), [criteres.q]);

  const actifs = Boolean(criteres.famille || criteres.usage || criteres.q);
  const options = [
    ['', t('catalogue.filtres.toutesFamilles')],
    ...familles.map((f) => [f.slug, t('catalogue.filtres.familleAvecNombre', { nom: f.nom, n: f.nombre_produits ?? 0 })]),
  ];
  // Famille de l'adresse absente de la liste (ancien lien) : on la garde visible pour pouvoir l'enlever.
  if (criteres.famille && !familles.some((f) => f.slug === criteres.famille)) options.push([criteres.famille, criteres.famille]);

  function rechercher(e) {
    e.preventDefault();
    changerCriteres({ q: recherche.trim() });
  }

  return (
    <div className={styles.filtres}>
      <form role="search" className={styles.recherche} onSubmit={rechercher}>
        <Champ libelle={t('catalogue.filtres.recherche')} type="search" name="q" value={recherche}
          onChange={(e) => setRecherche(e.target.value)} placeholder={t('catalogue.filtres.exempleRecherche')}
          enterKeyHint="search" />
        <Bouton type="submit" variante="sombre">{t('catalogue.filtres.rechercher')}</Bouton>
      </form>

      <Champ libelle={t('catalogue.filtres.famille')} name="famille" options={options} value={criteres.famille}
        onChange={(e) => changerCriteres({ famille: e.target.value })} />

      <div role="group" aria-labelledby={idUsages} className={styles.groupeUsages}>
        <span id={idUsages} className={styles.etiquette}>{t('catalogue.filtres.usage')}</span>
        <div className={styles.puces}>
          {['', ...USAGES].map((u) => (
            <button key={u || 'tous'} type="button" className={styles.puce} aria-pressed={criteres.usage === u}
              onClick={() => changerCriteres({ usage: u })}>
              {u ? t(`usages.${u}`) : t('catalogue.filtres.tousUsages')}
            </button>
          ))}
        </div>
      </div>

      {actifs && (
        <Bouton variante="texte" onClick={effacerCriteres} className={styles.effacer}>
          {t('catalogue.filtres.effacer')}
        </Bouton>
      )}
    </div>
  );
}
