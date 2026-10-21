// Filtres du catalogue (maquettes). Ordinateur : colonne de gauche (recherche arrondie, listes « Pour quel sol ? » et
// « Famille » avec un point corail devant le choix actif). Téléphone : pastilles « Tous les sols… » et liste déroulante
// « Famille ». Les critères vivent dans l'adresse. La recherche s'applique à la saisie (court délai) ou à Entrée.
import { useEffect, useId, useRef, useState } from 'react';

import { useEcranTelephone } from '@/app/preferences.js';
import { useTraduction } from '@/i18n/index.js';

import { USAGES } from '../usages.js';

const DELAI_RECHERCHE = 350; // ms

export default function Filtres({ criteres, familles = [], changerCriteres, effacerCriteres }) {
  const { t } = useTraduction();
  const telephone = useEcranTelephone();
  const idUsages = useId();
  const idFamilles = useId();
  const [recherche, setRecherche] = useState(criteres.q);
  const minuterie = useRef(0);

  // L'adresse peut changer sans ce champ (bouton « Précédent », lien) : la saisie suit.
  useEffect(() => setRecherche(criteres.q), [criteres.q]);
  useEffect(() => () => window.clearTimeout(minuterie.current), []);

  const actifs = Boolean(criteres.famille || criteres.usage || criteres.q);
  const choix = [['', t('catalogue.filtres.toutesFamilles')], ...familles.map((f) => [f.slug, f.nom])];
  // Famille de l'adresse absente de la liste (ancien lien) : on la garde visible pour pouvoir l'enlever.
  if (criteres.famille && !familles.some((f) => f.slug === criteres.famille)) choix.push([criteres.famille, criteres.famille]);
  const usages = [['', t('catalogue.filtres.tousUsages')], ...USAGES.map((u) => [u, t(`usages.${u}`)])];

  function saisir(e) {
    const valeur = e.target.value;
    setRecherche(valeur);
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => changerCriteres({ q: valeur.trim() }), DELAI_RECHERCHE);
  }
  function rechercher(e) {
    e.preventDefault();
    window.clearTimeout(minuterie.current);
    changerCriteres({ q: recherche.trim() });
  }

  const champRecherche = (
    <form role="search" onSubmit={rechercher}>
      <input type="search" name="q" value={recherche} onChange={saisir} placeholder={t('catalogue.filtres.rechercher')}
        aria-label={t('catalogue.filtres.recherche')} enterKeyHint="search" autoComplete="off" />
    </form>
  );
  const effacer = actifs && (
    <button type="button" className="effacer" onClick={effacerCriteres}>{t('catalogue.filtres.effacer')}</button>
  );

  if (telephone) {
    return (
      <div className="m-filtres">
        {champRecherche}
        <div role="group" aria-label={t('catalogue.filtres.usage')} className="m-puces-tel">
          {usages.map(([valeur, texte]) => (
            <button key={valeur || 'tous'} type="button" aria-pressed={criteres.usage === valeur}
              onClick={() => changerCriteres({ usage: valeur })}>{texte}</button>
          ))}
        </div>
        <div className="m-select-fam">
          <label htmlFor={idFamilles}>{t('catalogue.filtres.famille')}</label>
          <select id={idFamilles} value={criteres.famille} onChange={(e) => changerCriteres({ famille: e.target.value })}>
            {choix.map(([valeur, texte]) => <option key={valeur || 'toutes'} value={valeur}>{texte}</option>)}
          </select>
        </div>
        {effacer}
      </div>
    );
  }

  return (
    <div className="m-filtres">
      {champRecherche}
      <div role="group" aria-labelledby={idUsages}>
        <span id={idUsages} className="m-surtitre">{t('catalogue.filtres.usage')}</span>
        <ul>
          {usages.map(([valeur, texte]) => (
            <li key={valeur || 'tous'}>
              <button type="button" className="m-choix" aria-pressed={criteres.usage === valeur}
                onClick={() => changerCriteres({ usage: valeur })}>{texte}</button>
            </li>
          ))}
        </ul>
      </div>
      <div role="group" aria-labelledby={idFamilles}>
        <span id={idFamilles} className="m-surtitre">{t('catalogue.filtres.famille')}</span>
        <ul>
          {choix.map(([valeur, texte]) => (
            <li key={valeur || 'toutes'}>
              <button type="button" className="m-choix" aria-pressed={criteres.famille === valeur}
                onClick={() => changerCriteres({ famille: valeur })}>{texte}</button>
            </li>
          ))}
        </ul>
      </div>
      {effacer}
    </div>
  );
}
