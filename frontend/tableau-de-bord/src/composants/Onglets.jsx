// Onglets accessibles qui changent le contenu de la page (étapes d'une commande, devis / demandes de rendu…).
// Flèches gauche/droite, Début et Fin déplacent le choix ; le panneau est relié à l'onglet actif.
//
//   <Onglets libelle="Étapes" idBase="commandes" actif={etat} surChoix={setEtat}
//     onglets={[{ cle: 'nouvelle', libelle: 'Nouvelle', nombre: 3, urgent: true }]}>
//     …contenu…
//   </Onglets>
import { useRef } from 'react';

import styles from './Pilotage.module.css';

export default function Onglets({ libelle, onglets, actif, surChoix, idBase, children }) {
  const boutons = useRef({});

  function surTouche(e) {
    const i = onglets.findIndex((o) => o.cle === actif);
    const cibles = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: onglets.length - 1 };
    if (!(e.key in cibles)) return;
    e.preventDefault();
    const suivant = onglets[(cibles[e.key] + onglets.length) % onglets.length].cle;
    surChoix(suivant);
    boutons.current[suivant]?.focus();
  }

  return (
    <div>
      <div className={styles.onglets} role="tablist" aria-label={libelle} onKeyDown={surTouche}>
        {onglets.map((o) => {
          const estActif = o.cle === actif;
          return (
            <button key={o.cle} type="button" role="tab" id={`${idBase}-onglet-${o.cle}`}
              ref={(el) => { boutons.current[o.cle] = el; }}
              aria-selected={estActif} aria-controls={`${idBase}-panneau`} tabIndex={estActif ? 0 : -1}
              className={`${styles.onglet} ${estActif ? styles.ongletActif : ''}`} onClick={() => surChoix(o.cle)}>
              {o.libelle}
              {typeof o.nombre === 'number' && (
                <span className={`${styles.nombre} ${o.urgent && o.nombre > 0 ? styles.nombreUrgent : ''}`}>{o.nombre}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${idBase}-panneau`} aria-labelledby={`${idBase}-onglet-${actif}`} className={styles.panneau}>
        {children}
      </div>
    </div>
  );
}
