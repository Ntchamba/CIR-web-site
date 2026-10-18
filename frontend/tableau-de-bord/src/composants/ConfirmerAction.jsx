// Action qui demande une confirmation avant de partir (annuler une commande, accepter une proposition,
// envoyer un devis…). Le bouton ouvre un bloc avec la question, un champ facultatif (motif, message) et les
// boutons « Confirmer » / « Annuler ». L'erreur du serveur s'affiche dans le bloc.
//
//   <ConfirmerAction libelle="Annuler la commande" question="…" libelleConfirmer="Confirmer l'annulation"
//     champ={{ libelle: 'Motif', nom: 'motif' }} surConfirmation={(texte) => annuler(texte)} />
import { useEffect, useId, useRef, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';

import { useTraduction } from '@/i18n/index.js';

import styles from './Pilotage.module.css';

export default function ConfirmerAction({
  libelle, question, libelleConfirmer, champ, surConfirmation, variante = 'contour', desactive = false, taille,
}) {
  const { t } = useTraduction();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const bloc = useRef(null);
  const bouton = useRef(null);
  const retour = useRef(false);
  const id = useId();

  useEffect(() => {
    if (ouvert) bloc.current?.querySelector('textarea, button')?.focus();
    else if (retour.current) { bouton.current?.focus(); retour.current = false; }
  }, [ouvert]);

  function fermer() {
    retour.current = true;
    setOuvert(false);
    setErreur(null);
    setTexte('');
  }

  async function confirmer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await surConfirmation(texte.trim());
      setOuvert(false);
      setTexte('');
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <Bouton ref={bouton} variante={variante} taille={taille} disabled={desactive} onClick={() => setOuvert(true)}>
        {libelle}
      </Bouton>
    );
  }
  return (
    <div ref={bloc} className={styles.confirmation} role="group" aria-labelledby={`${id}-question`}>
      <p id={`${id}-question`}>{question}</p>
      {champ && (
        <Champ libelle={champ.libelle} multiligne name={champ.nom} rows={3} maxLength={champ.max || 1000} value={texte}
          onChange={(e) => setTexte(e.target.value)} />
      )}
      <div className={styles.boutonsConfirmation}>
        <Bouton variante="sombre" chargement={envoi} onClick={confirmer}>{libelleConfirmer}</Bouton>
        <Bouton variante="texte" onClick={fermer}>{t('actions.annuler')}</Bouton>
      </div>
      {erreur && <MessageErreur erreur={erreur} />}
    </div>
  );
}
