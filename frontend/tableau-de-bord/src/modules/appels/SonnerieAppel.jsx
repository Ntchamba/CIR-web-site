// Appels entrants (global, dans la coque) : bannière « Appel entrant de … » avec Répondre et Refuser, sonnerie répétée
// tant qu'un appel sonne (si le navigateur l'autorise), titre de l'onglet clignotant, arrêt dès qu'un autre
// membre répond. Répondre ouvre la salle (modérateur).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';
import { useDirect } from '@/layout/direct.js';

import { refuserAppel, repondreAppel, terminerAppel } from './api.js';
import { activerSonnerie, arreter, demarrer, useSonnerie } from './sonnerie.js';
import styles from './Appels.module.css';

const SalleAppel = lazy(() => import('./SalleAppel.jsx'));

/** Titre de l'onglet qui alterne avec `alternatif` tant que `actif` (le titre d'origine est rétabli à l'arrêt). */
function useTitreClignotant(actif, alternatif) {
  useEffect(() => {
    if (!actif) return undefined;
    let original = document.title;
    let alterne = false;
    const tic = () => {
      if (!alterne) {
        original = document.title;
        document.title = alternatif;
      } else {
        document.title = original;
      }
      alterne = !alterne;
    };
    tic();
    const minuteur = setInterval(tic, 1000);
    return () => {
      clearInterval(minuteur);
      if (alterne) document.title = original;
    };
  }, [actif, alternatif]);
}

export default function SonnerieAppel() {
  const { t } = useTraduction();
  const { utilisateur } = useAuth();
  const { appelsQuiSonnent, abonner, retirerAppel } = useDirect();
  const sonnerie = useSonnerie();
  const [salle, setSalle] = useState(null); // { appel, jitsi }
  const [occupes, setOccupes] = useState({});
  const [message, setMessage] = useState('');
  const salleRef = useRef(null);
  salleRef.current = salle;

  const sonne = appelsQuiSonnent.length > 0;
  const premier = appelsQuiSonnent[0];

  // Sonnerie : tant qu'un appel sonne.
  useEffect(() => {
    if (sonne && sonnerie.active) demarrer();
    else arreter();
    return arreter;
  }, [sonne, sonnerie.active]);

  useTitreClignotant(sonne, t('appels.entrant.titreOnglet', { nom: premier?.client?.nom_complet || '' }));

  // Le client raccroche pendant que la salle est ouverte : elle se ferme.
  useEffect(() => abonner((trame) => {
    if (trame.type !== 'appel_mis_a_jour') return;
    setSalle((s) => (s && s.appel.id === trame.appel?.id && ['termine', 'annule'].includes(trame.appel.etat) ? null : s));
  }), [abonner]);

  const marquerOccupe = (id, valeur) => setOccupes((o) => ({ ...o, [id]: valeur }));

  async function repondre(appel) {
    setMessage('');
    marquerOccupe(appel.id, true);
    try {
      const reponse = await repondreAppel(appel.id);
      retirerAppel(appel.id);
      setSalle({ appel: reponse.appel || appel, jitsi: reponse.jitsi });
    } catch (e) {
      const code = e?.donnees?.code;
      if (code === 'appel_pris') { setMessage(t('appels.entrant.pris')); retirerAppel(appel.id); }
      else if (code === 'appels_non_configures') setMessage(t('appels.nonConfigure'));
      else setMessage(e.message);
    } finally {
      marquerOccupe(appel.id, false);
    }
  }

  async function refuser(appel) {
    setMessage('');
    marquerOccupe(appel.id, true);
    try {
      await refuserAppel(appel.id);
      retirerAppel(appel.id);
    } catch (e) {
      setMessage(e.message);
    } finally {
      marquerOccupe(appel.id, false);
    }
  }

  const terminerSalle = useCallback(() => {
    const courante = salleRef.current;
    if (courante) terminerAppel(courante.appel.id).catch(() => {}); // déjà terminé côté serveur : sans conséquence
    setSalle(null);
  }, []);

  return (
    <>
      {(sonne || message) && (
        <section className={styles.bandeaux} aria-label={t('appels.entrant.region')}>
          {appelsQuiSonnent.map((appel) => (
            <div key={appel.id} className={styles.appelEntrant} role="alert">
              <p className={styles.texteAppel}>
                <strong>{t('appels.entrant.titre', { nom: appel.client?.nom_complet || '' })}</strong>
                <span>
                  {t(`appels.types.${appel.type}`)}
                  {appel.commande?.reference ? ` · ${appel.commande.reference}` : ''}
                </span>
              </p>
              <div className={styles.boutonsAppel}>
                <Bouton chargement={occupes[appel.id]} onClick={() => repondre(appel)}
                  aria-label={t('appels.entrant.repondrePour', { nom: appel.client?.nom_complet || '' })}>
                  {t('appels.entrant.repondre')}
                </Bouton>
                <Bouton variante="contour" disabled={occupes[appel.id]} onClick={() => refuser(appel)}
                  aria-label={t('appels.entrant.refuserPour', { nom: appel.client?.nom_complet || '' })}>
                  {t('appels.entrant.refuser')}
                </Bouton>
              </div>
            </div>
          ))}
          {sonne && sonnerie.disponible && !sonnerie.active && (
            <Bouton variante="texte" onClick={activerSonnerie}>{t('appels.sonnerie.activer')}</Bouton>
          )}
          <div aria-live="polite">{message && <p className={styles.messageAppel}>{message}</p>}</div>
        </section>
      )}
      {salle && (
        <Suspense fallback={<Chargement plein />}>
          <SalleAppel appel={salle.appel} jitsi={salle.jitsi} nomMembre={utilisateur?.nom_complet || utilisateur?.email}
            surFin={terminerSalle} />
        </Suspense>
      )}
    </>
  );
}
