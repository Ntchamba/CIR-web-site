// Fil de messages (du plus ancien au plus récent, groupés par jour). Reçoit l'état de `useFil`.
// - défilement vers le bas à l'arrivée d'un message sauf si la personne est remontée (bouton « nouveaux messages ») ;
// - historique chargé en remontant, sans sauter de position ;
// - « Lu » sous le dernier message lu ; indicateur « le client écrit… » ;
// - messages du client marqués lus seulement quand l'onglet est visible et que le bas du fil est atteint.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import { estReel } from '../useFil.js';
import { heure, jour } from './formats.js';
import PieceJointe from './PieceJointe.jsx';
import styles from '../Messagerie.module.css';

const SEUIL_BAS = 60; // px

function Bulle({ message, lu, surReessayer }) {
  const { t } = useTraduction();
  const { utilisateur } = useAuth();
  const propre = message.auteur_role === 'equipe';
  // Message de l'équipe écrit par un autre membre : son nom est affiché (id si le serveur le donne, sinon le nom).
  const idAuteur = message.auteur_id ?? (typeof message.auteur === 'number' ? message.auteur : message.auteur?.id);
  const autreMembre = propre && message.auteur_nom && (idAuteur != null && utilisateur?.id != null
    ? idAuteur !== utilisateur.id : message.auteur_nom !== utilisateur?.nom_complet);
  return (
    <li className={`${styles.ligneMessage} ${propre ? styles.propre : styles.autre}`}>
      <div className={`${styles.bulle} ${message.etat === 'echec' ? styles.bulleEchec : ''}`}>
        {(!propre || autreMembre) && message.auteur_nom && <strong className={styles.auteur}>{message.auteur_nom}</strong>}
        {message.commande?.reference && (
          <span className={styles.aPropos}>{t('messagerie.aPropos', { reference: message.commande.reference })}</span>
        )}
        {message.texte && <p className={styles.texteMessage}>{message.texte}</p>}
        {message.pieces_jointes?.map((p) => <PieceJointe key={p.id} piece={p} />)}
        <small className={styles.meta}>
          {heure(message.cree_le)}
          {message.etat === 'envoi' && <span> · {t('messagerie.envoiEnCours')}</span>}
        </small>
      </div>
      {message.etat === 'echec' && (
        <p className={styles.echec} role="alert">
          {t('messagerie.echec')}{message.erreur ? ` ${message.erreur}` : ''}{' '}
          <button type="button" className={styles.lienPiece} onClick={() => surReessayer(message.cle_client)}>
            {t('messagerie.reessayer')}
          </button>
        </p>
      )}
      {lu && <small className={styles.lu}>{t('messagerie.lu')}</small>}
    </li>
  );
}

export default function FilMessages({ conversationId, fil, surLu }) {
  const { t } = useTraduction();
  const { messages, aPlus, chargement, chargementPlus, erreur, ecrit, chargerPlus, reessayer, recharger } = fil;
  const zone = useRef(null);
  const procheDuBas = useRef(true);
  const suivi = useRef({ id: null, premier: null, dernier: null, hauteur: 0 });
  const luJusqua = useRef(0);
  const [nouveaux, setNouveaux] = useState(false);

  const estProche = () => {
    const el = zone.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_BAS;
  };
  const versLeBas = useCallback(() => {
    const el = zone.current;
    if (el) el.scrollTop = el.scrollHeight;
    procheDuBas.current = true;
    setNouveaux(false);
  }, []);

  const dernierNonLu = messages.filter((m) => estReel(m) && m.auteur_role === 'client' && !m.lu_le).at(-1)?.id || 0;
  const verifierLecture = useCallback(() => {
    if (!dernierNonLu || dernierNonLu <= luJusqua.current) return;
    if (document.visibilityState !== 'visible' || !estProche()) return;
    luJusqua.current = dernierNonLu;
    surLu?.(dernierNonLu);
  }, [dernierNonLu, surLu]);

  // Position après chaque changement de la liste.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el || chargement) return;
    const premier = messages.find(estReel)?.id ?? null;
    const dernierMessage = messages.at(-1);
    const dernier = dernierMessage ? (dernierMessage.cle_client || dernierMessage.id) : null;
    const avant = suivi.current;
    if (avant.id !== conversationId || avant.dernier === null) {
      versLeBas();
    } else if (premier !== null && avant.premier !== null && premier < avant.premier && dernier === avant.dernier) {
      el.scrollTop += el.scrollHeight - avant.hauteur; // historique ajouté en haut : la position ne bouge pas
    } else if (dernier !== avant.dernier) {
      if (procheDuBas.current || dernierMessage?.auteur_role === 'equipe') versLeBas();
      else setNouveaux(true);
    }
    suivi.current = { id: conversationId, premier, dernier, hauteur: el.scrollHeight };
  }, [messages, chargement, conversationId, versLeBas]);

  useEffect(() => { verifierLecture(); }, [verifierLecture, messages.length]);
  useEffect(() => {
    document.addEventListener('visibilitychange', verifierLecture);
    return () => document.removeEventListener('visibilitychange', verifierLecture);
  }, [verifierLecture]);

  function surDefilement() {
    procheDuBas.current = estProche();
    if (procheDuBas.current) { setNouveaux(false); verifierLecture(); }
  }

  // Dernier message de l'équipe lu par le client : « Lu » s'affiche sous celui-là seulement.
  const dernierLu = messages.filter((m) => m.auteur_role === 'equipe' && estReel(m) && m.lu_le).at(-1)?.id;

  const elements = [];
  let jourCourant = '';
  messages.forEach((m) => {
    const j = jour(m.cree_le);
    if (j !== jourCourant) {
      jourCourant = j;
      elements.push(<li key={`jour-${j}`} className={styles.jour}><span>{date(m.cree_le)}</span></li>);
    }
    elements.push(<Bulle key={m.cle_client || m.id} message={m} lu={m.id === dernierLu} surReessayer={reessayer} />);
  });

  return (
    <div className={styles.filConteneur}>
      <div ref={zone} className={styles.fil} role="log" aria-live="polite" aria-relevant="additions" tabIndex={0}
        aria-label={t('messagerie.fil')} onScroll={surDefilement}>
        {aPlus && (
          <div className={styles.plus}>
            <Bouton variante="contour" taille="petit" chargement={chargementPlus} onClick={chargerPlus}>
              {t('messagerie.chargerPlus')}
            </Bouton>
          </div>
        )}
        {chargement ? <Chargement texte={t('messagerie.chargement')} />
          : erreur ? <MessageErreur erreur={erreur} reessayer={recharger} />
            : messages.length === 0 ? <p className={styles.videFil}>{t('messagerie.filVide')}</p>
              : <ol className={styles.messages}>{elements}</ol>}
      </div>
      <div className={styles.indicateurs}>
        <p className={styles.ecrit} role="status">{ecrit ? t('messagerie.ecrit') : ''}</p>
        {nouveaux && (
          <Bouton variante="sombre" taille="petit" onClick={versLeBas}>{t('messagerie.nouveauxMessages')}</Bouton>
        )}
      </div>
    </div>
  );
}
