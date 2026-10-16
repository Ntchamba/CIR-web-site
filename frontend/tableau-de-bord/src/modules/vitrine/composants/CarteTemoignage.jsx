// Un témoignage à modérer : texte du client tel quel (avec sa langue), note, auteur ; publier, refuser avec un
// motif facultatif, supprimer avec confirmation.
import { useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import { infosLangue } from '@partage/i18n/langues.js';
import { dateHeure } from '@partage/utils/format.js';

import { useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import { nomLangue } from '@/composants/langues.js';
import { libelleUsage } from '@/composants/usages.js';
import gestion from '@/composants/Gestion.module.css';

import styles from '../Vitrine.module.css';

const CLASSES_STATUT = { en_attente: gestion.attention, publie: gestion.ok, refuse: gestion.neutre };

export default function CarteTemoignage({ temoignage, publier, refuser, supprimer }) {
  const { t } = useTraduction();
  const idTitre = useId();
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState('');
  const [erreur, setErreur] = useState(null);
  const tm = temoignage;
  const note = Math.max(0, Math.min(5, Number(tm.note) || 0));

  async function agir(nom, action) {
    setEnvoi(nom);
    setErreur(null);
    try {
      await action();
      setRefus(false);
      setMotif('');
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi('');
    }
  }

  return (
    <li className={`carte ${gestion.carteElement}`} aria-labelledby={idTitre}>
      <div className={styles.enteteTemoignage}>
        <div>
          <h3 id={idTitre} className={styles.auteur}>{tm.nom_affiche}</h3>
          <span className={gestion.secondaire}>
            {[tm.ville, libelleUsage(tm.type_chantier)].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
        <span className={`${gestion.pastille} ${CLASSES_STATUT[tm.statut] || gestion.neutre}`}>
          {t(`vitrine.temoignages.statuts.${tm.statut}`)}
        </span>
      </div>
      <p className={styles.note} role="img" aria-label={t('vitrine.temoignages.note', { note })}>
        <span aria-hidden="true">{'★'.repeat(note)}{'☆'.repeat(5 - note)}</span>
      </p>
      <blockquote className={styles.texte} lang={tm.langue ? infosLangue(tm.langue).html : undefined}>{tm.texte}</blockquote>
      <p className={gestion.secondaire}>
        {t('vitrine.temoignages.ecritEn', { langue: tm.langue ? nomLangue(tm.langue) : '—' })}
        {' · '}
        {t('vitrine.temoignages.recuLe', { date: dateHeure(tm.cree_le) })}
      </p>
      <p className={gestion.secondaire}>
        {tm.auteur ? t('vitrine.temoignages.compte', { email: tm.auteur.email }) : t('vitrine.temoignages.sansCompte')}
      </p>
      {tm.statut === 'refuse' && tm.motif_refus && (
        <p className={styles.motif}>{t('vitrine.temoignages.motifAffiche', { motif: tm.motif_refus })}</p>
      )}
      {tm.modere_le && <p className={gestion.secondaire}>{t('vitrine.temoignages.modereLe', { date: dateHeure(tm.modere_le) })}</p>}

      {refus ? (
        <div className={styles.refus} role="group" aria-label={t('vitrine.temoignages.refuserNom', { nom: tm.nom_affiche })}>
          <Champ libelle={t('vitrine.temoignages.motif')} multiligne name="motif" value={motif} maxLength={500}
            aide={t('vitrine.temoignages.aideMotif')} onChange={(e) => setMotif(e.target.value)} />
          <div className={gestion.actionsFormulaire}>
            <Bouton taille="petit" variante="sombre" chargement={envoi === 'refuser'}
              onClick={() => agir('refuser', () => refuser(tm.id, motif.trim()))}>
              {t('vitrine.temoignages.confirmerRefus')}
            </Bouton>
            <Bouton taille="petit" variante="texte" onClick={() => { setRefus(false); setMotif(''); }}>{t('actions.annuler')}</Bouton>
          </div>
        </div>
      ) : (
        <div className={gestion.boutonsLigne}>
          {tm.statut !== 'publie' && (
            <Bouton taille="petit" chargement={envoi === 'publier'} onClick={() => agir('publier', () => publier(tm.id))}
              aria-label={t('vitrine.temoignages.publierNom', { nom: tm.nom_affiche })}>
              {t('vitrine.temoignages.publier')}
            </Bouton>
          )}
          {tm.statut !== 'refuse' && (
            <Bouton taille="petit" variante="contour" onClick={() => setRefus(true)}
              aria-label={t('vitrine.temoignages.refuserNom', { nom: tm.nom_affiche })}>
              {t('vitrine.temoignages.refuser')}
            </Bouton>
          )}
          <BoutonSupprimer nom={tm.nom_affiche} surConfirmation={() => supprimer(tm.id)} />
        </div>
      )}
      {erreur && <p className={gestion.erreurChamp} role="alert">{erreur.message}</p>}
    </li>
  );
}
