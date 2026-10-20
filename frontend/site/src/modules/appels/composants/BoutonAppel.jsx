// BF-11 : bouton « Appeler l'équipe » (messagerie, détail d'une commande, page Contact).
// Masqué si l'appel n'est pas configuré côté serveur ; désactivé avec explication si l'équipe n'est pas en ligne.
import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';

import { ETATS_ACTIFS, useAppel } from '../AppelContext.jsx';
import { useDisponibilite } from '../useAppels.js';
import styles from '../Appels.module.css';

import ChoixAudioVideo from './ChoixAudioVideo.jsx';

/** Explication claire d'un refus du serveur (le texte du serveur sert de repli). */
function expliquer(erreur, t) {
  const code = erreur?.donnees?.code;
  const cles = { equipe_indisponible: 'equipeIndisponible', appel_deja_en_cours: 'dejaEnCours', appels_non_configures: 'nonConfigures' };
  if (code && cles[code]) {
    return { message: t(`appels.erreurs.${cles[code]}`), alternatives: code === 'equipe_indisponible' };
  }
  if (erreur?.statut === 429) return { message: t('appels.erreurs.trop'), alternatives: false };
  return { message: erreur?.message || t('commun.erreurInconnue'), alternatives: false };
}

export default function BoutonAppel({ commande = null, className = '' }) {
  const { t } = useTraduction();
  const { connecte } = useAuth();
  const { pathname, search } = useLocation();
  const { appel, lancer } = useAppel();
  const dispo = useDisponibilite(connecte);
  const [choix, setChoix] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const idAide = useId();

  if (!connecte) {
    return (
      <Link to={`/connexion?suite=${encodeURIComponent(pathname + search)}`} className={`${styles.lienConnexion} ${className}`}>
        <Icone nom="tel" taille={18} />&nbsp;{t('appels.connexionRequise')}
      </Link>
    );
  }
  if (!dispo.chargee || !dispo.configure) return null;
  if (appel && ETATS_ACTIFS.includes(appel.etat)) return null; // la salle d'appel est déjà ouverte

  async function choisir(type) {
    setEnvoi(true);
    setErreur(null);
    try {
      await lancer({ type, commande });
      setChoix(false);
    } catch (e) {
      setErreur(expliquer(e, t));
    } finally {
      setEnvoi(false);
    }
  }

  const indisponible = !dispo.equipeEnLigne;
  return (
    <div className={`${styles.bloc} ${className}`}>
      <Bouton variante="contour" aria-disabled={indisponible || undefined} aria-describedby={indisponible ? idAide : undefined}
        className={indisponible ? styles.desactive : ''}
        onClick={() => { if (!indisponible) { setErreur(null); setChoix(true); } }}>
        <Icone nom="tel" taille={18} />&nbsp;{t('appels.bouton')}
      </Bouton>
      {indisponible && (
        <p id={idAide} className={styles.explication}>
          {t('appels.equipeHorsLigne')}{' '}
          <Link to="/messages">{t('appels.ecrireMessage')}</Link>{' · '}
          <Link to="/contact">{t('appels.demanderRappel')}</Link>
        </p>
      )}
      {choix && <ChoixAudioVideo onChoisir={choisir} onFermer={() => setChoix(false)} envoi={envoi} erreur={erreur} />}
    </div>
  );
}
