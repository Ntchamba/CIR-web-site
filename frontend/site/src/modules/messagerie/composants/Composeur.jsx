// Saisie d'un message : Entrée envoie, Maj+Entrée fait un retour à la ligne, compteur de 2000 caractères,
// pièces jointes (3 au plus, contrôlées avant l'envoi), choix de la commande concernée.
import { useEffect, useId, useRef, useState } from 'react';

import { resultats } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import * as commandes from '@/modules/commandes/api.js';

import { controlerFichiers, FICHIERS_MAX, TEXTE_MAX, typeDeFichier } from '../regles.js';
import styles from '../Messagerie.module.css';

import { tailleLisible } from './tailles.js';

function Miniature({ fichier }) {
  const [adresse, setAdresse] = useState(null);
  useEffect(() => {
    if (typeDeFichier(fichier) !== 'image' || typeof URL.createObjectURL !== 'function') return undefined;
    const a = URL.createObjectURL(fichier);
    setAdresse(a);
    return () => URL.revokeObjectURL?.(a);
  }, [fichier]);
  return adresse ? <img src={adresse} alt="" className={styles.miniature} /> : <Icone nom="trombone" taille={20} />;
}

export default function Composeur({ onEnvoyer, onEcriture, commandeInitiale = '' }) {
  const { t } = useTraduction();
  const id = useId();
  const [texte, setTexte] = useState('');
  const [fichiers, setFichiers] = useState([]);
  const [refuses, setRefuses] = useState([]);
  const [liste, setListe] = useState([]);
  const [commande, setCommande] = useState(String(commandeInitiale || ''));
  const champFichier = useRef(null);

  // Commandes du client, pour joindre « à propos de… » (facultatif : une panne n'empêche pas d'écrire).
  useEffect(() => {
    let actif = true;
    commandes.lister({})
      .then((donnees) => actif && setListe(resultats(donnees)))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  const vide = !texte.trim() && fichiers.length === 0;

  function choisirFichiers(e) {
    const { acceptes, refuses: nonAcceptes } = controlerFichiers(fichiers.length, e.target.files);
    setFichiers((f) => [...f, ...acceptes]);
    setRefuses(nonAcceptes);
    e.target.value = '';
  }

  function envoyer() {
    if (vide) return;
    const choisie = liste.find((c) => String(c.id) === commande);
    onEnvoyer({
      texte: texte.trim(),
      commande: choisie ? { id: choisie.id, reference: choisie.reference } : (commande ? { id: Number(commande), reference: '' } : null),
      fichiers,
    });
    setTexte('');
    setFichiers([]);
    setRefuses([]);
  }

  function surTouche(e) {
    // Entrée envoie ; pas pendant la composition d'un texte chinois ou japonais (IME), où Entrée valide la saisie.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      envoyer();
    }
  }

  const reste = TEXTE_MAX - texte.length;
  return (
    <form className={styles.composeur} onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
      {liste.length > 0 && (
        <div className={styles.commande}>
          <label htmlFor={`${id}-commande`}>{t('messagerie.saisie.commande')}</label>
          <select id={`${id}-commande`} value={commande} onChange={(e) => setCommande(e.target.value)}>
            <option value="">{t('messagerie.saisie.aucuneCommande')}</option>
            {liste.map((c) => <option key={c.id} value={c.id}>{c.reference}</option>)}
          </select>
        </div>
      )}

      {fichiers.length > 0 && (
        <ul className={styles.fichiers} aria-label={t('messagerie.pieces.liste')}>
          {fichiers.map((f, i) => (
            <li key={`${f.name}-${i}`} className={styles.fichier}>
              <Miniature fichier={f} />
              <span className={styles.nomPiece}>{f.name} ({tailleLisible(f.size)})</span>
              <button type="button" className={styles.retrait} aria-label={t('messagerie.pieces.retirer', { nom: f.name })}
                onClick={() => setFichiers((liste2) => liste2.filter((_, j) => j !== i))}>
                <Icone nom="fermer" taille={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div role="alert">
        {refuses.map((r, i) => (
          <p key={`${r.nom}-${i}`} className={styles.erreurTexte}>{t(`messagerie.pieces.erreurs.${r.motif}`, { nom: r.nom, max: FICHIERS_MAX })}</p>
        ))}
      </div>

      <div className={styles.saisie}>
        <label htmlFor={`${id}-texte`} className="visuellement-cache">{t('messagerie.saisie.libelle')}</label>
        <textarea id={`${id}-texte`} value={texte} rows={2} maxLength={TEXTE_MAX}
          placeholder={t('messagerie.saisie.placeholder')} aria-describedby={`${id}-aide`}
          onChange={(e) => { setTexte(e.target.value); onEcriture?.(); }} onKeyDown={surTouche} />
        <div className={styles.actionsSaisie}>
          <input ref={champFichier} type="file" multiple className="visuellement-cache" tabIndex={-1}
            aria-label={t('messagerie.pieces.choisir')} accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={choisirFichiers} />
          <button type="button" className={styles.boutonIcone} onClick={() => champFichier.current?.click()}
            disabled={fichiers.length >= FICHIERS_MAX} aria-label={t('messagerie.pieces.ajouter')}>
            <Icone nom="trombone" />
          </button>
          <Bouton type="submit" disabled={vide} aria-label={t('messagerie.saisie.envoyer')}>
            <Icone nom="envoi" taille={18} />&nbsp;{t('messagerie.saisie.envoyer')}
          </Bouton>
        </div>
      </div>
      <div className={styles.aideSaisie}>
        <span id={`${id}-aide`}>{t('messagerie.saisie.aide')}</span>
        <span className={reste < 100 ? styles.compteurFort : undefined} aria-live="off">
          {t('messagerie.saisie.compteur', { n: texte.length, max: TEXTE_MAX })}
        </span>
      </div>
    </form>
  );
}
