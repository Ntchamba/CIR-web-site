// MODULE À VENIR : appels. Le panneau présente déjà les options prévues :
// téléphonie locale (Orange, MTN), appel depuis un autre pays d'Afrique, demande de rappel.
// Seule la demande de rappel fonctionne aujourd'hui (via le formulaire de contact).
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import Icone from '@/components/ui/Icone.jsx';
import useCoordonnees from '@/hooks/useCoordonnees.js';

import styles from './Appels.module.css';

export const OPTIONS_APPEL = [
  { code: 'local', titre: 'Appel local', detail: 'Par Orange ou MTN, au Cameroun.' },
  { code: 'afrique', titre: "Depuis un autre pays d'Afrique", detail: 'Avec votre opérateur Orange ou MTN.' },
];

export default function PanneauAppel({ onFermer }) {
  const { telephone } = useCoordonnees();
  const naviguer = useNavigate();
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  const boite = useRef(null);

  useEffect(() => {
    boite.current?.focus();
    const echap = (e) => e.key === 'Escape' && fermer.current();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, []);

  return (
    <div className={styles.calque}>
      <button type="button" className={styles.fond} onClick={onFermer} aria-label="Fermer" />
      <div ref={boite} tabIndex={-1} className={styles.boite} role="dialog" aria-modal="true" aria-labelledby="titre-appel">
        <div className={styles.entete}>
          <h2 id="titre-appel">Appeler le CIR</h2>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer"><Icone nom="fermer" /></button>
        </div>
        <ul className={styles.options}>
          {OPTIONS_APPEL.map((o) => (
            <li key={o.code} className={styles.option} aria-disabled="true">
              <Icone nom="tel" />
              <span><strong>{o.titre}</strong><small>{o.detail}</small></span>
              <span className={styles.bientot}>Bientôt</span>
            </li>
          ))}
          <li>
            <button type="button" className={styles.option}
              onClick={() => { onFermer(); naviguer('/#contact', { state: { objet: 'rappel' } }); }}>
              <Icone nom="calendrier" />
              <span><strong>Être rappelé</strong><small>Laissez votre numéro, l'équipe vous rappelle.</small></span>
              <Icone nom="fleche" taille={18} />
            </button>
          </li>
        </ul>
        <p className={styles.numero}>En attendant, notre numéro : <strong>{telephone}</strong></p>
      </div>
    </div>
  );
}
