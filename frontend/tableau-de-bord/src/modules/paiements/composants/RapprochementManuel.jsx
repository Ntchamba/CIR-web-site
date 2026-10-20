// Règlement hors ligne (espèces, virement, chèque, autre) enregistré par l'équipe pour une commande.
// Deux temps : formulaire, puis confirmation avant l'envoi (l'acte est tracé au nom de la personne et ne s'annule pas ici).
// Le montant est un entier en FCFA, jamais supérieur au reste à payer (contrôlé ici et, surtout, par le serveur).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { fcfa } from '@partage/utils/format.js';

import { erreursChamps } from '@/app/api.js';
import { useTraduction } from '@/i18n/index.js';

import { enregistrerReglement, MODES_MANUELS } from '../api.js';
import styles from '../Paiements.module.css';

export default function RapprochementManuel({ commande, surEnregistre, annoncer }) {
  const { t } = useTraduction();
  const reste = Number(commande.reste_a_payer) || 0;
  const [ouvert, setOuvert] = useState(false);
  const [montant, setMontant] = useState('');
  const [modeManuel, setModeManuel] = useState('especes');
  const [note, setNote] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [erreurMontant, setErreurMontant] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const champs = erreursChamps(erreur);

  const reinitialiser = () => {
    setOuvert(false); setMontant(''); setModeManuel('especes'); setNote('');
    setConfirmation(false); setErreurMontant(''); setErreur(null);
  };

  function verifier(e) {
    e.preventDefault();
    setErreur(null);
    const texte = montant.replace(/[\s  ]/g, '');
    if (!/^\d+$/.test(texte) || Number(texte) <= 0) {
      setErreurMontant(t('paiements.reglement.montantInvalide'));
      return;
    }
    if (Number(texte) > reste) {
      setErreurMontant(t('paiements.reglement.depasse', { reste: fcfa(reste) }));
      return;
    }
    setErreurMontant('');
    setConfirmation(true);
  }

  async function envoyer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const valeur = Number(montant.replace(/[\s  ]/g, ''));
      const corps = { montant: valeur, mode_manuel: modeManuel };
      if (note.trim()) corps.note = note.trim();
      await enregistrerReglement(commande.id, corps);
      annoncer?.(t('paiements.reglement.annonce', { montant: fcfa(valeur) }));
      reinitialiser();
      surEnregistre?.();
    } catch (e) {
      setErreur(e);
      setConfirmation(false);
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <div>
        <Bouton variante="contour" onClick={() => setOuvert(true)}>{t('paiements.reglement.ouvrir')}</Bouton>
      </div>
    );
  }

  const texteMontant = Number(montant.replace(/[\s  ]/g, ''));
  return (
    <form className={styles.reglement} onSubmit={verifier} noValidate aria-label={t('paiements.reglement.titre')}>
      <h3 className={styles.titreSection}>{t('paiements.reglement.titre')}</h3>
      <p className={styles.vide}>{t('paiements.reglement.aide')}</p>
      <div className={styles.grille}>
        <Champ libelle={t('paiements.reglement.montant')} name="montant" inputMode="numeric" autoComplete="off" required
          value={montant} disabled={confirmation}
          onChange={(e) => { setMontant(e.target.value); setErreurMontant(''); }}
          aide={t('paiements.reglement.resteAPayer', { reste: fcfa(reste) })}
          erreur={erreurMontant || champs.montant} />
        <Champ libelle={t('paiements.reglement.mode')} name="mode_manuel" value={modeManuel} disabled={confirmation}
          options={MODES_MANUELS.map((c) => [c, t(`paiements.modesManuels.${c}`)])}
          onChange={(e) => setModeManuel(e.target.value)} erreur={champs.mode_manuel} />
      </div>
      <Champ libelle={t('paiements.reglement.note')} name="note" multiligne rows={2} maxLength={300} value={note}
        disabled={confirmation} onChange={(e) => setNote(e.target.value)} erreur={champs.note} />
      {erreur && !champs.montant && !champs.mode_manuel && !champs.note && <MessageErreur erreur={erreur} />}

      {confirmation ? (
        <div role="group" aria-label={t('paiements.reglement.confirmation')} className={styles.reglement}>
          <p>{t('paiements.reglement.question', { montant: fcfa(texteMontant), mode: t(`paiements.modesManuels.${modeManuel}`) })}</p>
          <div className={styles.actions}>
            <Bouton variante="sombre" chargement={envoi} onClick={envoyer}>{t('paiements.reglement.confirmer')}</Bouton>
            <Bouton variante="texte" disabled={envoi} onClick={() => setConfirmation(false)}>{t('paiements.reglement.modifier')}</Bouton>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Bouton type="submit">{t('paiements.reglement.enregistrer')}</Bouton>
          <Bouton variante="texte" onClick={reinitialiser}>{t('actions.annuler')}</Bouton>
        </div>
      )}
    </form>
  );
}
