// Saisie d'un contenu multilingue : un onglet « Français » (obligatoire, champs habituels) et un onglet par
// autre langue (facultatif, objet `traductions`). Une pastille signale les langues à compléter.
//
//   <OngletsLangues champs={[{ nom: 'nom', libelle: t('…'), required: true }, { nom: 'description', multiligne: true }]}
//     valeurs={form} traductions={form.traductions} erreurs={erreurs}
//     surChangement={(champ, valeur) => …} surTraductions={(traductions) => …} />
//
// `BarreLangues` (la seule rangée d'onglets) sert aux éditeurs de listes (couches, caractéristiques).
import { useEffect, useId, useRef, useState } from 'react';

import Champ from '@partage/ui/Champ.jsx';
import { infosLangue, LANGUES } from '@partage/i18n/langues.js';

import { useTraduction } from '@/i18n/index.js';
import BoutonBrouillonIA from '@/modules/assistant/composants/BoutonBrouillonIA.jsx';

import { languesIncompletes, LANGUE_REFERENCE, modifierTraduction, nomLangue, texteTraduit } from './langues.js';
import styles from './Composants.module.css';

const LONGUEUR_APERCU = 120;
const apercu = (texte) => (texte.length > LONGUEUR_APERCU ? `${texte.slice(0, LONGUEUR_APERCU)}…` : texte);

/** Rangée d'onglets des cinq langues (flèches gauche/droite, Début, Fin). */
export function BarreLangues({ langue, surChoix, incompletes = [], idPanneau, libelle }) {
  const { t } = useTraduction();
  const boutons = useRef({});
  const codes = LANGUES.map((l) => l.code);

  function surTouche(e) {
    const i = codes.indexOf(langue);
    const cibles = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: codes.length - 1 };
    if (!(e.key in cibles)) return;
    e.preventDefault();
    const suivant = codes[(cibles[e.key] + codes.length) % codes.length];
    surChoix(suivant);
    boutons.current[suivant]?.focus();
  }

  return (
    <div className={styles.onglets} role="tablist" aria-label={libelle || t('langues.onglets')} onKeyDown={surTouche}>
      {codes.map((code) => {
        const actif = code === langue;
        const aCompleter = incompletes.includes(code);
        return (
          <button key={code} type="button" role="tab" ref={(el) => { boutons.current[code] = el; }}
            id={idPanneau ? `${idPanneau}-onglet-${code}` : undefined}
            aria-selected={actif} aria-controls={idPanneau} tabIndex={actif ? 0 : -1}
            className={`${styles.onglet} ${actif ? styles.ongletActif : ''}`} onClick={() => surChoix(code)}>
            <span lang={infosLangue(code).html}>{nomLangue(code)}</span>
            {code === LANGUE_REFERENCE && <span className="visuellement-cache"> {t('langues.obligatoire')}</span>}
            {aCompleter && (
              <>
                <span className={styles.pastilleLangue} aria-hidden="true" />
                <span className="visuellement-cache"> {t('langues.aCompleter')}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pastille « Traductions à compléter : English, Deutsch » (rien si tout est traduit). */
export function PastilleTraductions({ langues }) {
  const { t } = useTraduction();
  if (!langues?.length) return null;
  return (
    <span className={styles.pastilleTraductions}>
      {t('langues.aCompleterListe', { langues: langues.map(nomLangue).join(', ') })}
    </span>
  );
}

export default function OngletsLangues({ champs, valeurs, traductions, surChangement, surTraductions, erreurs = {}, libelle, contexteIA }) {
  const { t } = useTraduction();
  const [langue, setLangue] = useState(LANGUE_REFERENCE);
  const idPanneau = useId();
  const incompletes = languesIncompletes({ ...valeurs, traductions }, champs.map((c) => c.nom));

  // Une erreur sur un champ français ramène sur l'onglet Français pour qu'elle soit visible.
  const erreurFrancais = champs.some((c) => erreurs[c.nom]);
  useEffect(() => {
    if (erreurFrancais) setLangue(LANGUE_REFERENCE);
  }, [erreurFrancais, erreurs]);

  const html = infosLangue(langue).html;
  return (
    <div className={styles.multilingue}>
      <BarreLangues langue={langue} surChoix={setLangue} incompletes={incompletes} idPanneau={idPanneau} libelle={libelle} />
      <div id={idPanneau} role="tabpanel" aria-labelledby={`${idPanneau}-onglet-${langue}`} className={styles.panneauLangue}>
        {langue === LANGUE_REFERENCE ? (
          champs.map((c) => (
            <Champ key={c.nom} name={c.nom} libelle={c.libelle} multiligne={c.multiligne} required={c.required}
              maxLength={c.maxLength} aide={c.aide} type={c.type} value={valeurs?.[c.nom] ?? ''} lang={html}
              onChange={(e) => surChangement(c.nom, e.target.value)} erreur={erreurs[c.nom]} />
          ))
        ) : (
          <>
            <p className={styles.aideLangue}>{t('langues.facultatif', { langue: nomLangue(langue) })}</p>
            {/* Propositions de l'assistant : copiées champ par champ, à la demande, jamais appliquées d'office. */}
            <BoutonBrouillonIA type="traduction" contexte={contexteIA} libelle={t('assistant.bouton.traductions')}
              libelleCopie={t('assistant.copier.champ')}
              textes={champs.map((c) => ({ nom: c.nom, libelle: c.libelle, texte: String(valeurs?.[c.nom] ?? '') }))}
              surCopie={(propositions) => surTraductions(propositions.reduce(
                (acc, p) => (p.langue && p.langue !== LANGUE_REFERENCE ? modifierTraduction(acc, p.langue, p.nom, p.texte) : acc),
                traductions || {}))} />
            {champs.map((c) => {
              const francais = String(valeurs?.[c.nom] ?? '');
              return (
                <Champ key={`${langue}-${c.nom}`} name={`${c.nom}-${langue}`} multiligne={c.multiligne}
                  libelle={t('langues.libelleTraduit', { champ: c.libelle, langue: nomLangue(langue) })}
                  maxLength={c.maxLength} lang={html} value={texteTraduit(traductions, langue, c.nom)}
                  aide={francais.trim() ? t('langues.texteFrancais', { texte: apercu(francais) }) : t('langues.francaisVide')}
                  onChange={(e) => surTraductions(modifierTraduction(traductions, langue, c.nom, e.target.value))} />
              );
            })}
          </>
        )}
        {erreurs.traductions && <p className={styles.erreurBloc} role="alert">{erreurs.traductions}</p>}
      </div>
    </div>
  );
}
