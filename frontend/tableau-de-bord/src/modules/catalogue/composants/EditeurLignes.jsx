// Éditeur d'une liste ordonnée de petits objets traduits (caractéristiques, couches) : ajout, retrait, ordre.
// Une rangée d'onglets choisit la langue des textes saisis ; les champs non traduits restent visibles.
// Chaque ligne : { cle (locale), ...champs, traductions }. `cle` n'est jamais envoyée au serveur.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import { infosLangue } from '@partage/i18n/langues.js';

import { useTraduction } from '@/i18n/index.js';
import { BarreLangues } from '@/composants/OngletsLangues.jsx';
import {
  languesIncompletes, LANGUE_REFERENCE, modifierTraduction, nomLangue, texteTraduit,
} from '@/composants/langues.js';
import gestion from '@/composants/Gestion.module.css';

let compteur = 0;
/** Clé locale unique d'une ligne (React). */
export const nouvelleCle = () => `l${(compteur += 1)}`;

/** Lignes reçues du serveur → lignes éditables. */
export const versLignes = (liste, champs) => (liste || []).map((ligne) => ({
  cle: nouvelleCle(),
  ...Object.fromEntries(champs.map((c) => [c, ligne?.[c] ?? ''])),
  traductions: ligne?.traductions || {},
}));

/** Lignes éditables → liste envoyée au serveur (lignes vides ignorées). */
export const depuisLignes = (lignes, champs) => lignes
  .filter((l) => champs.some((c) => String(l[c] ?? '').trim()))
  .map((l) => ({ ...Object.fromEntries(champs.map((c) => [c, String(l[c] ?? '').trim()])), traductions: l.traductions || {} }));

/**
 * `champsTraduits` / `champsFixes` : [{ nom, libelle }] ; `libelles` : { titre, ajouter, ligne(n), vide, aide } ;
 * `apercu(lignes)` : rendu facultatif sous la liste (ex. plan de coupe).
 */
export default function EditeurLignes({ lignes, surChangement, champsTraduits, champsFixes = [], libelles, erreur, apercu }) {
  const { t } = useTraduction();
  const [langue, setLangue] = useState(LANGUE_REFERENCE);
  const idPanneau = useId();
  const noms = champsTraduits.map((c) => c.nom);
  const incompletes = languesIncompletes(lignes, noms);
  const html = infosLangue(langue).html;

  const modifier = (cle, changements) => surChangement(lignes.map((l) => (l.cle === cle ? { ...l, ...changements } : l)));
  const changerTexte = (ligne, champ, valeur) => {
    if (langue === LANGUE_REFERENCE) modifier(ligne.cle, { [champ]: valeur });
    else modifier(ligne.cle, { traductions: modifierTraduction(ligne.traductions, langue, champ, valeur) });
  };
  const deplacer = (index, sens) => {
    const copie = [...lignes];
    const [ligne] = copie.splice(index, 1);
    copie.splice(index + sens, 0, ligne);
    surChangement(copie);
  };
  const ajouter = () => surChangement([...lignes, {
    cle: nouvelleCle(), ...Object.fromEntries([...noms, ...champsFixes.map((c) => c.nom)].map((c) => [c, ''])), traductions: {},
  }]);

  return (
    <fieldset className={gestion.bloc}>
      <legend>{libelles.titre}</legend>
      {libelles.aide && <p className={gestion.aide}>{libelles.aide}</p>}
      <BarreLangues langue={langue} surChoix={setLangue} incompletes={incompletes} idPanneau={idPanneau}
        libelle={t('langues.ongletsDe', { titre: libelles.titre })} />
      <div id={idPanneau} role="tabpanel" aria-labelledby={`${idPanneau}-onglet-${langue}`}>
        {lignes.length === 0 ? (
          <p className={gestion.aide}>{libelles.vide}</p>
        ) : (
          <ol className={gestion.lignes}>
            {lignes.map((ligne, i) => {
              const nomLigne = libelles.ligne(i + 1);
              return (
                <li key={ligne.cle} className={gestion.ligne} aria-label={nomLigne}>
                  {champsTraduits.map((c) => (
                    <Champ key={c.nom} lang={html} name={`${c.nom}-${i}`}
                      libelle={langue === LANGUE_REFERENCE ? `${c.libelle} (${nomLigne})`
                        : t('langues.libelleTraduit', { champ: `${c.libelle} (${nomLigne})`, langue: nomLangue(langue) })}
                      value={langue === LANGUE_REFERENCE ? ligne[c.nom] ?? '' : texteTraduit(ligne.traductions, langue, c.nom)}
                      placeholder={langue === LANGUE_REFERENCE ? undefined : String(ligne[c.nom] ?? '')}
                      onChange={(e) => changerTexte(ligne, c.nom, e.target.value)} />
                  ))}
                  {champsFixes.map((c) => (
                    <Champ key={c.nom} name={`${c.nom}-${i}`} libelle={`${c.libelle} (${nomLigne})`} value={ligne[c.nom] ?? ''}
                      onChange={(e) => modifier(ligne.cle, { [c.nom]: e.target.value })} />
                  ))}
                  <div className={gestion.boutonsLigne}>
                    <button type="button" className={gestion.icone} disabled={i === 0} onClick={() => deplacer(i, -1)}
                      aria-label={t('actions.monterNom', { nom: nomLigne })}>↑</button>
                    <button type="button" className={gestion.icone} disabled={i === lignes.length - 1}
                      onClick={() => deplacer(i, 1)} aria-label={t('actions.descendreNom', { nom: nomLigne })}>↓</button>
                    <button type="button" className={gestion.icone}
                      onClick={() => surChangement(lignes.filter((l) => l.cle !== ligne.cle))}
                      aria-label={t('actions.retirerNom', { nom: nomLigne })}>✕</button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {erreur && <p className={gestion.erreurChamp} role="alert">{erreur}</p>}
      {apercu?.(lignes)}
      <div><Bouton variante="contour" taille="petit" onClick={ajouter}>{libelles.ajouter}</Bouton></div>
    </fieldset>
  );
}
