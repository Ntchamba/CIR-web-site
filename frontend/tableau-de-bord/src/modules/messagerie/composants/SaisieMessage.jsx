// Saisie d'un message : Entrée envoie, Maj+Entrée va à la ligne (sauf pendant une composition au clavier chinois ou
// japonais), compteur de 2000 caractères, 3 pièces jointes au plus (types et tailles contrôlés avant l'envoi),
// choix de la commande « à propos de… ». Indique au client que l'équipe écrit (au plus une fois toutes les 3 secondes).
import { useEffect, useId, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { ajouterTexte } from '@/modules/assistant/erreurs.js';

import { ACCEPT, commandesDuClient, MAX_FICHIERS, MAX_OCTETS, MAX_TEXTE, TYPES_ACCEPTES } from '../api.js';
import { tailleFichier } from './formats.js';
import styles from '../Messagerie.module.css';

const DELAI_ECRIT = 3000;

function Apercu({ fichier, surRetrait }) {
  const { t } = useTraduction();
  const [adresse, setAdresse] = useState('');
  useEffect(() => {
    if (!fichier.type.startsWith('image/') || typeof URL.createObjectURL !== 'function') return undefined;
    const a = URL.createObjectURL(fichier);
    setAdresse(a);
    return () => URL.revokeObjectURL(a);
  }, [fichier]);
  return (
    <li className={styles.apercuFichier}>
      {adresse && <img src={adresse} alt="" width="40" height="40" />}
      <span>{fichier.name} ({tailleFichier(fichier.size)})</span>
      <button type="button" className={styles.retrait} onClick={surRetrait}
        aria-label={t('messagerie.saisie.retirer', { nom: fichier.name })}>
        <Icone nom="fermer" taille={16} />
      </button>
    </li>
  );
}

export default function SaisieMessage({ clientId, surEnvoi, surEcrit, insertion }) {
  const { t } = useTraduction();
  const [texte, setTexte] = useState('');
  const [fichiers, setFichiers] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [commande, setCommande] = useState('');
  const [erreurs, setErreurs] = useState([]);
  const dernierEcrit = useRef(0);
  const choixFichier = useRef(null);
  const id = useId();
  const zone = useRef(null);

  // Texte proposé par l'assistant et copié volontairement : ajouté à la saisie, à relire avant d'envoyer.
  useEffect(() => {
    if (!insertion?.texte) return;
    setTexte((actuel) => ajouterTexte(actuel, insertion.texte).slice(0, MAX_TEXTE));
    zone.current?.focus();
  }, [insertion]);

  useEffect(() => {
    setCommandes([]);
    setCommande('');
    if (!clientId) return undefined;
    const controleur = new AbortController();
    commandesDuClient(clientId, { signal: controleur.signal }).then(setCommandes).catch(() => {});
    return () => controleur.abort();
  }, [clientId]);

  function ajouter(liste) {
    const refus = [];
    const acceptes = [...fichiers];
    Array.from(liste).forEach((f) => {
      if (acceptes.length >= MAX_FICHIERS) { if (!refus.includes('nombre')) refus.push('nombre'); return; }
      if (!TYPES_ACCEPTES.includes(f.type)) { refus.push(t('messagerie.saisie.erreurType', { nom: f.name })); return; }
      if (f.size === 0) { refus.push(t('messagerie.saisie.erreurVide', { nom: f.name })); return; }
      if (f.size > MAX_OCTETS) { refus.push(t('messagerie.saisie.erreurTaille', { nom: f.name })); return; }
      acceptes.push(f);
    });
    setFichiers(acceptes);
    setErreurs(refus.map((r) => (r === 'nombre' ? t('messagerie.saisie.erreurNombre', { max: MAX_FICHIERS }) : r)));
  }

  function envoyer() {
    const propre = texte.trim();
    if (!propre && fichiers.length === 0) return;
    const choisie = commandes.find((c) => String(c.id) === commande) || null;
    surEnvoi({ texte: propre, fichiers, commande: choisie });
    setTexte('');
    setFichiers([]);
    setErreurs([]);
    setCommande('');
  }

  function surChangement(e) {
    setTexte(e.target.value);
    const maintenant = Date.now();
    if (e.target.value && maintenant - dernierEcrit.current >= DELAI_ECRIT) {
      dernierEcrit.current = maintenant;
      surEcrit?.();
    }
  }

  function surTouche(e) {
    // Pendant une composition (clavier chinois, japonais), Entrée valide le texte composé : on n'envoie pas.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      envoyer();
    }
  }

  const restant = MAX_TEXTE - texte.length;
  return (
    <form className={styles.saisie} onSubmit={(e) => { e.preventDefault(); envoyer(); }} aria-label={t('messagerie.saisie.formulaire')}>
      {commandes.length > 0 && (
        <Champ libelle={t('messagerie.saisie.apropos')} name="commande" value={commande}
          options={[['', t('messagerie.saisie.aucuneCommande')], ...commandes.map((c) => [String(c.id), c.reference])]}
          onChange={(e) => setCommande(e.target.value)} />
      )}
      <label htmlFor={`${id}-texte`} className="visuellement-cache">{t('messagerie.saisie.message')}</label>
      <textarea ref={zone} id={`${id}-texte`} className={styles.zoneTexte} rows={2} maxLength={MAX_TEXTE} value={texte}
        placeholder={t('messagerie.saisie.placeholder')} aria-describedby={`${id}-aide`}
        onChange={surChangement} onKeyDown={surTouche} />
      {fichiers.length > 0 && (
        <ul className={styles.fichiers} aria-label={t('messagerie.saisie.fichiers')}>
          {fichiers.map((f, i) => (
            <Apercu key={`${f.name}-${i}`} fichier={f} surRetrait={() => setFichiers((l) => l.filter((_, k) => k !== i))} />
          ))}
        </ul>
      )}
      {erreurs.length > 0 && (
        <ul className={styles.erreursSaisie} role="alert">
          {erreurs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <div className={styles.barreSaisie}>
        <input ref={choixFichier} type="file" accept={ACCEPT} multiple hidden tabIndex={-1} data-testid="choix-fichier"
          onChange={(e) => { ajouter(e.target.files); e.target.value = ''; }} />
        <Bouton variante="contour" onClick={() => choixFichier.current?.click()} disabled={fichiers.length >= MAX_FICHIERS}>
          {t('messagerie.saisie.joindre')}
        </Bouton>
        <span id={`${id}-aide`} className={styles.compteur}>
          {t('messagerie.saisie.aide')} · {t('messagerie.saisie.restant', { n: restant })}
        </span>
        <Bouton type="submit" disabled={!texte.trim() && fichiers.length === 0}>{t('messagerie.saisie.envoyer')}</Bouton>
      </div>
    </form>
  );
}
