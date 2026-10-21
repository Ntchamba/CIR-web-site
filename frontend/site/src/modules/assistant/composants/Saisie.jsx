// Champ de saisie : Entrée envoie, Maj+Entrée retour à la ligne (pas pendant une composition IME), compteur de 1000.
import { forwardRef } from 'react';

import Icone from '@partage/ui/Icone.jsx';
import { infosLangue } from '@partage/i18n/langues.js';

import { useTraduction } from '@/i18n/index.js';

import { LONGUEUR_MAX } from '../regles.js';
import styles from '../Assistant.module.css';

const Saisie = forwardRef(function Saisie({ valeur, surChangement, surEnvoi, envoi, desactive }, ref) {
  const { t, langue } = useTraduction();
  const touche = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      surEnvoi();
    }
  };
  const vide = valeur.trim().length === 0;
  return (
    <form className={styles.saisie} onSubmit={(e) => { e.preventDefault(); surEnvoi(); }}>
      <label htmlFor="assistant-saisie" className="visuellement-cache">{t('assistant.saisie.libelle')}</label>
      <textarea
        id="assistant-saisie" ref={ref} className={styles.champ} rows={2} value={valeur} maxLength={LONGUEUR_MAX}
        lang={infosLangue(langue).html} placeholder={t('assistant.saisie.placeholder')}
        aria-describedby="assistant-compteur" onChange={(e) => surChangement(e.target.value)} onKeyDown={touche}
      />
      <button type="submit" className={styles.envoyer} aria-label={t('assistant.saisie.envoyer')} disabled={envoi || desactive || vide}>
        <Icone nom="envoi" taille={20} />
      </button>
      <span id="assistant-compteur" className={styles.compteur}>{t('assistant.saisie.compteur', { n: valeur.length, max: LONGUEUR_MAX })}</span>
    </form>
  );
});

export default Saisie;
