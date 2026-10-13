// Panneau latéral (ajout ou modification d'un produit, d'une réalisation…). Échap pour fermer.
import { useEffect, useRef } from 'react';

import Icone from './Icone.jsx';

export default function Tiroir({ titre, onFermer, pied, children }) {
  const boite = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    boite.current?.focus();
    const echap = (e) => e.key === 'Escape' && fermer.current();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, []);

  return (
    <div className="tiroir-calque">
      <button type="button" className="tiroir-fond" aria-label="Fermer" onClick={onFermer} />
      <aside ref={boite} tabIndex={-1} className="tiroir" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="tiroir-entete">
          <h2>{titre}</h2>
          <button type="button" className="bouton-icone" onClick={onFermer} aria-label="Fermer"><Icone nom="fermer" /></button>
        </div>
        <div className="tiroir-corps">{children}</div>
        {pied && <div className="tiroir-pied">{pied}</div>}
      </aside>
    </div>
  );
}
