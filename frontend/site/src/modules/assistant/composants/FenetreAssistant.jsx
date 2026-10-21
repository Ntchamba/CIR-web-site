// Fenêtre de dialogue de l'assistant : role="dialog" modal, focus piégé, Échap ferme, plein écran sur téléphone.
// Le focus revient au bouton de la bulle (géré par BulleAssistant à la fermeture).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';

import FilAssistant from './FilAssistant.jsx';
import Saisie from './Saisie.jsx';
import styles from '../Assistant.module.css';

const SUGGESTIONS = ['revetements', 'devis', 'commande', 'equipe'];
const FOCALISABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function FenetreAssistant({ assistant, surFermeture }) {
  const { t } = useTraduction();
  const racine = useRef(null);
  const saisie = useRef(null);
  const [confirmation, setConfirmation] = useState(false);
  const {
    messages, texte, setTexte, envoi, chargement, erreur, proposerContact, avis, connecte,
    envoyer, effacer, donnerAvis, fermerErreur,
  } = assistant;

  useEffect(() => {
    saisie.current?.focus();
  }, []);

  const touche = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      surFermeture();
      return;
    }
    if (e.key !== 'Tab' || !racine.current) return;
    const liste = [...racine.current.querySelectorAll(FOCALISABLES)];
    if (!liste.length) return;
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    const actif = document.activeElement;
    if (e.shiftKey && (actif === premier || !racine.current.contains(actif))) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && (actif === dernier || !racine.current.contains(actif))) {
      e.preventDefault();
      premier.focus();
    }
  };

  const confirmerEffacement = async () => {
    await effacer();
    setConfirmation(false);
    saisie.current?.focus();
  };

  return (
    // Le voile couvre toute la page et intercepte les clics (cohérent avec aria-modal) ; un clic hors de la fenêtre ferme.
    <div className={styles.voile} onMouseDown={(e) => { if (e.target === e.currentTarget) surFermeture(); }}>
      <div
        ref={racine} className={styles.fenetre} role="dialog" aria-modal="true" aria-labelledby="assistant-titre"
        onKeyDown={touche}
      >
        <header className={styles.haut}>
          <h2 id="assistant-titre" className={styles.titre}>{t('assistant.titre')}</h2>
          <button type="button" className={styles.fermer} aria-label={t('assistant.fermer')} onClick={surFermeture}>
            <Icone nom="fermer" taille={22} />
          </button>
        </header>

        <p className={styles.bandeau}>{t('assistant.avertissement')}</p>

        {messages.length === 0 && !chargement && (
          <div className={styles.accueil}>
            <p>{t('assistant.accueil')}</p>
            <ul className={styles.suggestions} aria-label={t('assistant.suggestionsTitre')}>
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className={styles.suggestion} disabled={envoi} onClick={() => envoyer(t(`assistant.suggestions.${s}`))}>
                    {t(`assistant.suggestions.${s}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {chargement && <p className={styles.ecrit} role="status">{t('assistant.chargement')}</p>}
        <FilAssistant messages={messages} envoi={envoi} avis={avis} donnerAvis={donnerAvis} surLien={surFermeture} />

        {proposerContact && (
          <div className={styles.equipe}>
            <p>{t('assistant.equipe.intro')}</p>
            <div className={styles.equipeBoutons}>
              <Link className={styles.lienBouton} to={connecte ? '/messages' : '/contact'} onClick={surFermeture}>
                {t('assistant.equipe.ecrire')}
              </Link>
              <Link className={styles.lienBouton} to="/devis/demande" onClick={surFermeture}>{t('assistant.equipe.devis')}</Link>
            </div>
          </div>
        )}

        {erreur && (
          <p className={styles.erreur} role="alert">
            {t(erreur)}
            <button type="button" className={styles.lienTexte} onClick={fermerErreur}>{t('assistant.ok')}</button>
          </p>
        )}

        <Saisie ref={saisie} valeur={texte} surChangement={setTexte} surEnvoi={() => envoyer()} envoi={envoi} desactive={chargement} />

        <div className={styles.pied}>
          {messages.length > 0 && !confirmation && (
            <button type="button" className={styles.lienTexte} onClick={() => setConfirmation(true)}>{t('assistant.effacer.bouton')}</button>
          )}
          {confirmation && (
            <span className={styles.confirmation} role="group" aria-label={t('assistant.effacer.question')}>
              {t('assistant.effacer.question')}
              <button type="button" className={styles.lienTexte} onClick={confirmerEffacement}>{t('assistant.effacer.oui')}</button>
              <button type="button" className={styles.lienTexte} onClick={() => setConfirmation(false)}>{t('assistant.effacer.non')}</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
