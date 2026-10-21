// Détail d'une demande de contact dans un tiroir : coordonnées (tel:/mailto:), message du visiteur ou du client,
// langue à utiliser pour répondre, réponse de l'équipe, état et notes internes.
import { useState } from 'react';
import { Link } from 'react-router';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure } from '@partage/utils/format.js';

import { erreursChamps } from '@/app/api.js';
import LiensContact from '@/composants/LiensContact.jsx';
import NotesInternes from '@/composants/NotesInternes.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import { useTraduction } from '@/i18n/index.js';

import BoutonBrouillonIA from '@/modules/assistant/composants/BoutonBrouillonIA.jsx';
import { ajouterTexte } from '@/modules/assistant/erreurs.js';

import { modifierDemande } from '../api.js';
import { ETATS } from '../useContact.js';
import styles from '../Contact.module.css';

function Info({ libelle, children }) {
  return <div className={styles.info}><dt>{libelle}</dt><dd>{children || '—'}</dd></div>;
}

export default function TiroirDemande({ demande, surFermeture, surMiseAJour }) {
  const { t } = useTraduction();
  const [etat, setEtat] = useState(demande.etat);
  const [reponse, setReponse] = useState(demande.reponse_equipe || '');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [annonce, setAnnonce] = useState('');
  const champs = erreursChamps(erreur);
  const langue = demande.langue ? infosLangue(demande.langue).nom : '';

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setAnnonce('');
    try {
      const maj = await modifierDemande(demande.id, { etat, reponse_equipe: reponse });
      surMiseAJour({ ...demande, ...maj, id: demande.id, etat: maj?.etat ?? etat, reponse_equipe: maj?.reponse_equipe ?? reponse });
      setAnnonce(t('contact.tiroir.enregistree'));
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Tiroir ouvert large titre={t('contact.tiroir.titre', { reference: demande.reference })}
      sousTitre={t(`contact.types.${demande.type}`)} surFermeture={surFermeture}>
      <section className={styles.section} aria-labelledby="contact-qui">
        <h3 id="contact-qui" className={styles.titreSection}>{t('contact.tiroir.expediteur')}</h3>
        <dl className={styles.infos}>
          <Info libelle={t('contact.tiroir.nom')}>{demande.nom}</Info>
          <Info libelle={t('contact.tiroir.coordonnees')}><LiensContact email={demande.email} telephone={demande.telephone} /></Info>
          <Info libelle={t('contact.tiroir.langue')}>
            {langue && <>{langue}<span className={styles.langue}> {t('contact.tiroir.repondreEn', { langue })}</span></>}
          </Info>
          <Info libelle={t('contact.tiroir.compte')}>
            {demande.auteur ? <Link to={`/clients/${demande.auteur.id}`}>{demande.auteur.nom_complet}</Link> : t('contact.tiroir.visiteur')}
          </Info>
          <Info libelle={t('contact.tiroir.recueLe')}>{dateHeure(demande.cree_le)}</Info>
          {demande.traitee_le && <Info libelle={t('contact.tiroir.traiteeLe')}>{dateHeure(demande.traitee_le)}</Info>}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="contact-message">
        <h3 id="contact-message" className={styles.titreSection}>{t('contact.tiroir.message')}</h3>
        <dl className={styles.infos}>
          <Info libelle={t('contact.tiroir.type')}>{t(`contact.types.${demande.type}`)}</Info>
          {demande.type === 'rappel' && (
            <Info libelle={t('contact.tiroir.creneau')}>{demande.creneau && t(`contact.creneaux.${demande.creneau}`)}</Info>
          )}
          {demande.produit && <Info libelle={t('contact.tiroir.produit')}>{demande.produit.nom}</Info>}
        </dl>
        <p className={styles.texteClient}>{demande.message}</p>
      </section>

      <form className={styles.section} onSubmit={enregistrer} noValidate aria-label={t('contact.tiroir.suivi')}>
        <h3 className={styles.titreSection}>{t('contact.tiroir.suivi')}</h3>
        <Champ libelle={t('contact.tiroir.etat')} name="etat" value={etat} erreur={champs.etat}
          options={ETATS.map((c) => [c, t(`contact.etats.${c}`)])} onChange={(e) => setEtat(e.target.value)} />
        <Champ libelle={t('contact.tiroir.reponse')} name="reponse_equipe" multiligne rows={4} value={reponse}
          erreur={champs.reponse_equipe} aide={t('contact.tiroir.reponseAide')} onChange={(e) => setReponse(e.target.value)} />
        <BoutonBrouillonIA type="reponse_contact" cibleId={demande.id} libelle={t('assistant.bouton.contact')}
          libelleCopie={t('assistant.copier.reponse')}
          surCopie={([proposition]) => setReponse((actuelle) => ajouterTexte(actuelle, proposition.texte))} />
        {erreur && !champs.etat && !champs.reponse_equipe && <MessageErreur erreur={erreur} />}
        <div><Bouton type="submit" chargement={envoi}>{t('contact.tiroir.enregistrer')}</Bouton></div>
        <p role="status" aria-live="polite" className={annonce ? styles.annonce : 'visuellement-cache'}>{annonce}</p>
      </form>

      <NotesInternes valeur={demande.notes_internes}
        surEnregistrement={async (texte) => {
          await modifierDemande(demande.id, { notes_internes: texte });
          surMiseAJour({ ...demande, notes_internes: texte });
        }} />
    </Tiroir>
  );
}
