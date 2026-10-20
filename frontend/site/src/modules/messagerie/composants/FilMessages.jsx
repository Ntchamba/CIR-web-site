// Fil de la conversation : du plus ancien au plus récent, groupé par jour. « Lu » sous les messages lus,
// indicateur « l'équipe écrit… », historique chargé en remontant, défilement vers le bas à l'arrivée d'un message
// sauf si la personne est remontée lire.
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';

import { jourDe } from '../regles.js';
import styles from '../Messagerie.module.css';

import PieceJointe from './PieceJointe.jsx';

const SEUIL_BAS = 80;
const SEUIL_HAUT = 40;

const heure = (valeur, locale) => {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
};

function Bulle({ message, onReessayer, onRetirer }) {
  const { t, locale } = useTraduction();
  const moi = message.auteur_role === 'client';
  const statut = message.statut;
  return (
    <li className={`${styles.ligne} ${moi ? styles.moi : styles.equipe}`}>
      <div className={`${styles.bulle} ${moi ? styles.bulleMoi : styles.bulleEquipe}`}>
        <span className="visuellement-cache">{moi ? t('messagerie.vous') : (message.auteur_nom || t('messagerie.equipe'))}</span>
        {!moi && message.auteur_nom && <span className={styles.auteur} aria-hidden="true">{message.auteur_nom}</span>}
        {message.commande && (
          <Link to={`/commandes/${message.commande.id}`} className={styles.aPropos}>
            {t('messagerie.aPropos', { reference: message.commande.reference })}
          </Link>
        )}
        {message.texte && <p className={styles.texte}>{message.texte}</p>}
        {(message.pieces_jointes || []).map((p) => <PieceJointe key={p.id} piece={p} />)}
        <span className={styles.pied}>
          <time dateTime={message.cree_le}>{heure(message.cree_le, locale)}</time>
          {moi && statut === 'envoi' && <span> · {t('messagerie.envoiEnCours')}</span>}
          {moi && !statut && message.lu_le && <span> · {t('messagerie.lu')}</span>}
          {moi && !statut && !message.lu_le && <span> · {t('messagerie.envoye')}</span>}
        </span>
      </div>
      {moi && statut === 'echec' && (
        <div className={styles.echec} role="alert">
          <span>{t('messagerie.echec')}{message.erreur ? ` : ${message.erreur}` : ''}</span>
          <button type="button" onClick={() => onReessayer(message.cle_client)}>{t('messagerie.reessayer')}</button>
          <button type="button" onClick={() => onRetirer(message.cle_client)}>{t('messagerie.retirer')}</button>
        </div>
      )}
    </li>
  );
}

export default function FilMessages({
  messages, aPlus, chargement, chargementAvant, erreur, equipeEcrit, onChargerAvant, onRecharger, onReessayer, onRetirer, onAuBas,
}) {
  const { t } = useTraduction();
  const zone = useRef(null);
  const auBas = useRef(true);
  const precedent = useRef({ premier: null, dernier: null, hauteur: 0 });
  const [nouveaux, setNouveaux] = useState(false);

  const mesurer = useCallback(() => {
    const z = zone.current;
    if (!z) return true;
    return z.scrollHeight - z.scrollTop - z.clientHeight < SEUIL_BAS;
  }, []);

  function surDefilement() {
    const z = zone.current;
    const bas = mesurer();
    if (bas !== auBas.current) {
      auBas.current = bas;
      onAuBas?.(bas);
    }
    if (bas) setNouveaux(false);
    if (z && z.scrollTop < SEUIL_HAUT && aPlus && !chargementAvant && !chargement) onChargerAvant();
  }

  // À chaque changement du fil : historique ajouté en haut (la position est conservée), nouveau message en bas.
  useLayoutEffect(() => {
    const z = zone.current;
    const avant = precedent.current;
    const premier = messages[0]?.id ?? messages[0]?.cle_client ?? null;
    const dernier = messages.at(-1)?.id ?? messages.at(-1)?.cle_client ?? null;
    if (z) {
      if (avant.premier !== null && premier !== avant.premier && dernier === avant.dernier) {
        z.scrollTop += z.scrollHeight - avant.hauteur;
      } else if (dernier !== avant.dernier) {
        const sien = messages.at(-1)?.auteur_role === 'client';
        if (auBas.current || sien) {
          z.scrollTop = z.scrollHeight;
          auBas.current = true;
          setNouveaux(false);
        } else {
          setNouveaux(true);
        }
      }
    }
    precedent.current = { premier, dernier, hauteur: z ? z.scrollHeight : 0 };
    // Le bas du fil est (ré)évalué après chaque changement.
    onAuBas?.(mesurer());
  }, [messages, mesurer, onAuBas]);

  function allerAuBas() {
    const z = zone.current;
    if (z) z.scrollTop = z.scrollHeight;
    auBas.current = true;
    setNouveaux(false);
    onAuBas?.(true);
  }

  const aujourdhui = jourDe(new Date());
  const hier = jourDe(new Date(Date.now() - 86_400_000));
  const elements = [];
  let jourCourant = '';
  messages.forEach((m) => {
    const jour = jourDe(m.cree_le);
    if (jour !== jourCourant) {
      jourCourant = jour;
      const libelle = jour === aujourdhui ? t('messagerie.aujourdhui') : jour === hier ? t('messagerie.hier') : date(m.cree_le);
      elements.push(<li key={`jour-${jour}`} className={styles.jour}><span>{libelle}</span></li>);
    }
    elements.push(<Bulle key={m.cle_client && m.id === null ? m.cle_client : `m-${m.id}`} message={m}
      onReessayer={onReessayer} onRetirer={onRetirer} />);
  });

  return (
    <div className={styles.filConteneur}>
      <div ref={zone} className={styles.fil} onScroll={surDefilement} role="log" aria-label={t('messagerie.fil')} tabIndex={0}>
        {aPlus && (
          <div className={styles.historique}>
            <Bouton variante="contour" taille="petit" onClick={onChargerAvant} chargement={chargementAvant}>
              {t('messagerie.chargerAvant')}
            </Bouton>
          </div>
        )}
        {chargement && messages.length === 0 && <Chargement />}
        <MessageErreur erreur={erreur} reessayer={onRecharger} />
        {!chargement && !erreur && messages.length === 0 && <p className={styles.vide}>{t('messagerie.vide')}</p>}
        <ul className={styles.messages}>{elements}</ul>
      </div>
      <div className={styles.indicateurs} aria-live="polite">
        {equipeEcrit && <span className={styles.ecrit}>{t('messagerie.ecrit')}</span>}
      </div>
      {nouveaux && (
        <button type="button" className={styles.nouveaux} onClick={allerAuBas}>{t('messagerie.nouveaux')}</button>
      )}
    </div>
  );
}
