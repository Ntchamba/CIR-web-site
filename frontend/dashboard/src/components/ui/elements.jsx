// Petits éléments du tableau de bord : statut, chargement, erreur, interrupteur, champ, « bientôt disponible ».
import { useId } from 'react';

import { STATUTS } from '@shared/format.js';

export function BadgeStatut({ statut, libelle }) {
  const info = STATUTS[statut] || { libelle: libelle || statut, classe: 'annulee' };
  return <span className={`badge ${info.classe}`}>{libelle || info.libelle}</span>;
}

export function Erreur({ erreur, reessayer }) {
  if (!erreur) return null;
  return (
    <div className="erreur" role="alert">
      <span>{typeof erreur === 'string' ? erreur : erreur.message}</span>
      {reessayer && <button type="button" onClick={reessayer}>Réessayer</button>}
    </div>
  );
}

export function Interrupteur({ actif, onChange, libelle, disabled }) {
  return (
    <button type="button" role="switch" className="interrupteur" aria-checked={Boolean(actif)} aria-label={libelle}
      disabled={disabled} onClick={() => onChange(!actif)} />
  );
}

export function Champ({ libelle, aide, options, multiligne, ...props }) {
  const id = useId();
  let saisie;
  if (options) saisie = <select id={id} {...props}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
  else if (multiligne) saisie = <textarea id={id} {...props} />;
  else saisie = <input id={id} {...props} />;
  return (
    <div className="champ">
      <label htmlFor={id}>{libelle}</label>
      {saisie}
      {aide && <span className="aide">{aide}</span>}
    </div>
  );
}

export function BientotDisponible({ titre, children }) {
  return (
    <div className="bientot-bloc">
      <span className="bientot-pastille">Bientôt disponible</span>
      <h2>{titre}</h2>
      {children}
    </div>
  );
}

export function Kpi({ libelle, valeur, note, vers }) {
  const contenu = (
    <>
      <span className="libelle">{libelle}</span>
      <span className="valeur">{valeur}</span>
      {note && <span className="note">{note}</span>}
    </>
  );
  return vers ? <a className="kpi" href={vers}>{contenu}</a> : <div className="kpi">{contenu}</div>;
}
