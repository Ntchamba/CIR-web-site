// BF-11 : salle d'appel plein écran. Le script Jitsi n'est chargé qu'au lancement d'un appel.
// États : « ça sonne… » (annuler), « connecté », « personne n'a répondu » (écrire ou demander un rappel), fin d'appel.
// L'expiration à 60 s est appliquée par le serveur à chaque lecture : la salle relit l'appel toutes les 5 s tant qu'il sonne.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import { useEvenementsDirect } from '@/modules/notifications/FondDirect.jsx';

import { ETATS_ACTIFS, useAppel } from '../AppelContext.jsx';
import * as appels from '../api.js';
import { chargerJitsi } from '../jitsi.js';
import styles from '../Appels.module.css';

export const DELAI_LECTURE_APPEL = 5000;
const LANGUES_JITSI = { fr: 'fr', en: 'en', zh: 'zhCN', de: 'de', ja: 'ja' };
const BOUTONS_AUDIO = ['microphone', 'hangup', 'fullscreen'];
const BOUTONS_VIDEO = ['microphone', 'camera', 'hangup', 'tileview', 'fullscreen'];

/** 'refuse' | 'absent' | null : le navigateur donne-t-il accès au micro (et à la caméra) ? */
async function sonder(type) {
  const medias = navigator.mediaDevices;
  if (!medias?.getUserMedia) return null;
  try {
    const flux = await medias.getUserMedia({ audio: true, video: type === 'video' });
    flux.getTracks().forEach((piste) => piste.stop());
    return null;
  } catch (e) {
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'absent';
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || e?.name === 'PermissionDeniedError') return 'refuse';
    return null;
  }
}

function Salle() {
  const { t, langue } = useTraduction();
  const { utilisateur } = useAuth();
  const { appel, jitsi, type, mettreAJour, fermer } = useAppel();
  const id = useId();
  const conteneur = useRef(null);
  const apiJitsi = useRef(null);
  const principal = useRef(null);
  const [statut, setStatut] = useState('chargement'); // chargement | ouvert | erreur
  const [media, setMedia] = useState(null); // refuse | absent
  const [erreurAction, setErreurAction] = useState('');
  const actif = ETATS_ACTIFS.includes(appel.etat);
  const appelId = appel.id;

  const appliquer = useCallback((reponse) => {
    if (reponse?.appel) mettreAJour(reponse.appel);
  }, [mettreAJour]);

  const raccrocher = useCallback(async () => {
    setErreurAction('');
    try {
      appliquer(appel.etat === 'sonne' ? await appels.annuler(appelId) : await appels.terminer(appelId));
    } catch (e) {
      setErreurAction(e.message);
    }
  }, [appel.etat, appelId, appliquer]);
  const raccrocherRef = useRef(raccrocher);
  useEffect(() => {
    raccrocherRef.current = raccrocher;
  });

  // Mises à jour poussées par le serveur (réponse de l'équipe, refus, fin).
  useEvenementsDirect((trame) => {
    if (trame.type === 'appel_mis_a_jour' && trame.appel?.id === appelId) mettreAJour(trame.appel);
  });

  // Lecture régulière tant que l'appel sonne : applique l'expiration à 60 s et rattrape un événement manqué.
  useEffect(() => {
    if (appel.etat !== 'sonne') return undefined;
    const minuteur = setInterval(() => {
      appels.lire(appelId).then(appliquer).catch(() => {});
    }, DELAI_LECTURE_APPEL);
    return () => clearInterval(minuteur);
  }, [appel.etat, appelId, appliquer]);

  // Micro et caméra : explication claire si le navigateur les refuse.
  useEffect(() => {
    let vivant = true;
    if (actif) sonder(type).then((m) => vivant && setMedia(m));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appelId]);

  // Ouverture de l'appel Jitsi ; libération propre quand l'appel se termine ou que la salle se ferme.
  useEffect(() => {
    if (!actif || !jitsi) return undefined;
    let vivant = true;
    let instance = null;
    setStatut('chargement');
    chargerJitsi(jitsi)
      .then((JitsiMeetExternalAPI) => {
        if (!vivant || !conteneur.current) return;
        const boutons = type === 'video' ? BOUTONS_VIDEO : BOUTONS_AUDIO;
        instance = new JitsiMeetExternalAPI(jitsi.domaine, {
          roomName: `${jitsi.app_id}/${jitsi.salle}`,
          jwt: jitsi.jeton,
          parentNode: conteneur.current,
          width: '100%',
          height: '100%',
          lang: LANGUES_JITSI[langue] || 'en',
          userInfo: { displayName: utilisateur?.nom_complet || '' },
          configOverwrite: {
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: type !== 'video',
            toolbarButtons: boutons,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: boutons,
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            HIDE_INVITE_MORE_HEADER: true,
          },
        });
        apiJitsi.current = instance;
        // L'interface Jitsi (bouton raccrocher) termine aussi l'appel côté CIR.
        const fin = () => vivant && raccrocherRef.current();
        instance.addListener?.('readyToClose', fin);
        instance.addListener?.('videoConferenceLeft', fin);
        setStatut('ouvert');
      })
      .catch(() => {
        if (!vivant) return;
        setStatut('erreur');
        appels.annuler(appelId).then(appliquer).catch(() => {}); // l'équipe ne doit pas sonner dans le vide
      });
    return () => {
      vivant = false;
      try {
        instance?.dispose?.();
      } catch {
        /* déjà libérée */
      }
      apiJitsi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, appelId, jitsi]);

  // Focus sur l'action principale à chaque changement d'écran.
  useEffect(() => {
    principal.current?.focus();
  }, [appel.etat, statut]);

  const termine = !actif;
  const sonne = appel.etat === 'sonne';
  const messageFin = {
    manque: t('appels.salle.manque'),
    refuse: t('appels.salle.refuse'),
    termine: t('appels.salle.termine'),
    annule: t('appels.salle.annule'),
  }[appel.etat];
  let texteEtat = messageFin;
  if (statut === 'erreur') texteEtat = t('appels.salle.erreurChargement');
  else if (sonne) texteEtat = t('appels.salle.sonne');
  else if (appel.etat === 'en_cours') texteEtat = t('appels.salle.connecte');
  const proposeAlternatives = appel.etat === 'manque' || appel.etat === 'refuse' || statut === 'erreur';

  return (
    <div className={styles.salle} role="dialog" aria-modal="true" aria-labelledby={`${id}-titre`}>
      <header className={styles.salleHaut}>
        <h2 id={`${id}-titre`}>{type === 'video' ? t('appels.salle.titreVideo') : t('appels.salle.titreAudio')}</h2>
        {actif && (
          <Bouton ref={principal} className={styles.raccrocher} onClick={raccrocher}>
            <Icone nom="raccrocher" taille={20} />&nbsp;{sonne ? t('appels.salle.annuler') : t('appels.salle.raccrocher')}
          </Bouton>
        )}
      </header>

      {/* Une seule zone d'état, annoncée aux lecteurs d'écran à chaque changement. */}
      <div role="status" aria-live="polite" className={termine || statut === 'erreur' ? styles.statutFin : `${styles.statut} ${sonne ? styles.sonne : ''}`}>
        {texteEtat}
      </div>

      {media && actif && (
        <p className={styles.alerteMedia} role="alert">
          {media === 'refuse'
            ? (type === 'video' ? t('appels.salle.mediaRefuseVideo') : t('appels.salle.mediaRefuseAudio'))
            : t('appels.salle.mediaAbsent')}
        </p>
      )}
      {erreurAction && <p className={styles.alerteMedia} role="alert">{erreurAction}</p>}

      {actif && statut !== 'erreur' && (
        <div className={styles.zoneJitsi}>
          {statut === 'chargement' && <p className={styles.chargement}>{t('appels.salle.chargement')}</p>}
          <div ref={conteneur} className={styles.jitsi} />
        </div>
      )}

      {(termine || statut === 'erreur') && (
        <div className={styles.fin}>
          <div className={styles.finActions}>
            {proposeAlternatives && (
              <>
                <Bouton as={Link} to="/messages" onClick={fermer}>{t('appels.ecrireMessage')}</Bouton>
                <Bouton as={Link} to="/contact" variante="contour" onClick={fermer}>{t('appels.demanderRappel')}</Bouton>
              </>
            )}
            <Bouton ref={termine ? principal : undefined} variante="texte" onClick={fermer}>{t('appels.salle.fermer')}</Bouton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalleAppel() {
  const { appel } = useAppel();
  if (!appel) return null;
  return <Salle key={appel.id} />;
}
