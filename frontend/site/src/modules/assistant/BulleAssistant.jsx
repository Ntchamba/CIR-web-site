// Bouton flottant de l'assistant. Chargé à la demande (chunk séparé, voir layout/Gabarit.jsx) ; masqué tant que le
// serveur n'a pas dit que l'assistant est configuré ; affiché mais désactivé (avec explication) si la limite du jour
// est atteinte. Le focus revient au bouton à la fermeture de la fenêtre.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import FenetreAssistant from './composants/FenetreAssistant.jsx';
import useAssistant, { useDisponibilite } from './useAssistant.js';
import styles from './Assistant.module.css';

export default function BulleAssistant() {
  const { t } = useTraduction();
  const dispo = useDisponibilite();
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState(false);
  const bouton = useRef(null);
  const etaitOuvert = useRef(false);
  const assistant = useAssistant({ ouvert });

  useEffect(() => {
    if (etaitOuvert.current && !ouvert) bouton.current?.focus();
    etaitOuvert.current = ouvert;
  }, [ouvert]);

  if (!dispo.pret || !dispo.configure || assistant.nonConfigure) return null;
  const ferme = !dispo.ouvert;

  return (
    <>
      {/* Le bouton reste dans la page (masqué pendant le dialogue) pour récupérer le focus à la fermeture. */}
      <div className={styles.bulle} hidden={ouvert}>
        {ferme && note && (
          <p className={styles.noteLimite} role="status">
            {t('assistant.limite')} <Link to="/contact">{t('assistant.equipe.ecrire')}</Link>
          </p>
        )}
        <button
          ref={bouton} type="button" className={styles.boutonBulle} aria-haspopup="dialog" aria-disabled={ferme || undefined}
          onClick={() => (ferme ? setNote((n) => !n) : setOuvert(true))}
        >
          <Icone nom="message" taille={22} />
          <span>{t('assistant.bulle')}</span>
        </button>
      </div>
      {ouvert && <FenetreAssistant assistant={assistant} surFermeture={() => setOuvert(false)} />}
    </>
  );
}
