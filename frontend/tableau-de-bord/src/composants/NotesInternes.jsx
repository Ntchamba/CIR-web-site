// Notes internes de l'équipe (commande, demande de rendu, demande de contact). Jamais visibles du client.
// Enregistrement explicite : rien ne part tant qu'on n'a pas cliqué sur « Enregistrer les notes ».
// `surEnregistrement(texte)` renvoie une promesse ; une erreur 400 s'affiche sous le champ.
import { useEffect, useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import { erreursChamps } from '@/app/api.js';

import styles from './Pilotage.module.css';

export default function NotesInternes({ valeur = '', surEnregistrement, titre }) {
  const { t } = useTraduction();
  const id = useId();
  const [texte, setTexte] = useState(valeur || '');
  const [enregistre, setEnregistre] = useState(valeur || '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [annonce, setAnnonce] = useState('');

  // Le serveur peut renvoyer une autre valeur (autre élément ouvert) : on repart de celle-ci si rien n'est en cours.
  useEffect(() => {
    setTexte((courant) => (courant === enregistre ? (valeur || '') : courant));
    setEnregistre(valeur || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  const modifie = texte !== enregistre;
  const champs = erreursChamps(erreur);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setAnnonce('');
    try {
      await surEnregistrement(texte);
      setEnregistre(texte);
      setAnnonce(t('notes.enregistrees'));
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className={styles.notes} onSubmit={enregistrer} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className={styles.titreCarte}>{titre || t('notes.titre')}</h2>
      <p className={styles.avertissement}>{t('notes.avertissement')}</p>
      <Champ libelle={t('notes.libelle')} multiligne name="notes_internes" rows={5} value={texte}
        erreur={champs.notes_internes} onChange={(e) => { setTexte(e.target.value); setAnnonce(''); }} />
      {erreur && !champs.notes_internes && <MessageErreur erreur={erreur} />}
      <div>
        <Bouton type="submit" variante="contour" chargement={envoi} disabled={!modifie}>{t('notes.enregistrer')}</Bouton>
      </div>
      <p role="status" aria-live="polite" className={annonce ? styles.annonce : 'visuellement-cache'}>{annonce}</p>
    </form>
  );
}
