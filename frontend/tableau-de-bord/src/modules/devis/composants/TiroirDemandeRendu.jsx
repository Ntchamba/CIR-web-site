// Demande de rendu d'un client, dans un tiroir : description, images en grand, produit de référence, commande,
// coordonnées (tel:/mailto:), réponse à l'équipe et état, « Créer un devis », notes internes.
import { useState } from 'react';
import { Link } from 'react-router';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure, fcfa, surface } from '@partage/utils/format.js';

import { erreursChamps } from '@/app/api.js';
import LiensContact from '@/composants/LiensContact.jsx';
import NotesInternes from '@/composants/NotesInternes.jsx';
import { PastilleDevis } from '@/composants/PastilleEtat.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import useChargement from '@/composants/useChargement.js';
import { useTraduction } from '@/i18n/index.js';

import { modifierDemandeRendu, obtenirDemandeRendu } from '../api.js';
import styles from '../Devis.module.css';

export const ETATS_RENDU = ['nouvelle', 'en_etude', 'devis_envoye', 'close'];

function Info({ libelle, children }) {
  return <div className={styles.info}><dt>{libelle}</dt><dd>{children || '—'}</dd></div>;
}

function Contenu({ demande, surMiseAJour }) {
  const { t } = useTraduction();
  const [etat, setEtat] = useState(demande.etat);
  const [reponse, setReponse] = useState(demande.reponse_equipe || '');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [annonce, setAnnonce] = useState('');
  const champs = erreursChamps(erreur);
  const client = demande.client || {};
  const langue = client.langue ? infosLangue(client.langue).nom : '';
  const commandeId = typeof demande.commande === 'object' ? demande.commande?.id : demande.commande;

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setAnnonce('');
    try {
      const maj = await modifierDemandeRendu(demande.id, { etat, reponse_equipe: reponse });
      surMiseAJour({ ...demande, ...maj, etat: maj?.etat ?? etat });
      setAnnonce(t('devis.demandes.enregistree'));
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <section className={styles.section} aria-labelledby="rendu-client">
        <h3 id="rendu-client" className={styles.titreCarte}>{t('devis.demandes.client')}</h3>
        <dl className={styles.infos}>
          <Info libelle={t('devis.demandes.nom')}>
            {client.id ? <Link to={`/clients/${client.id}`}>{client.nom_complet}</Link> : client.nom_complet}
          </Info>
          <Info libelle={t('devis.demandes.coordonnees')}><LiensContact email={client.email} telephone={client.telephone} /></Info>
          {langue && <Info libelle={t('devis.demandes.langue')}>{langue}</Info>}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="rendu-demande">
        <h3 id="rendu-demande" className={styles.titreCarte}>{t('devis.demandes.demande')}</h3>
        <dl className={styles.infos}>
          <Info libelle={t('devis.demandes.type')}>{t(`commandes.types.${demande.type_batiment}`)}</Info>
          <Info libelle={t('devis.demandes.surface')}>{surface(demande.surface_m2)}</Info>
          <Info libelle={t('devis.demandes.produit')}>{demande.produit?.nom}</Info>
          <Info libelle={t('devis.demandes.commande')}>
            {commandeId ? <Link to={`/commandes/${commandeId}`}>{t('devis.demandes.voirCommande')}</Link> : ''}
          </Info>
          <Info libelle={t('devis.demandes.recueLe')}>{dateHeure(demande.cree_le)}</Info>
        </dl>
        <p className={styles.texteClient}>{demande.description}</p>
        {(demande.images || []).length > 0 && (
          <ul className={styles.images} aria-label={t('devis.demandes.images')}>
            {demande.images.map((image, i) => (
              <li key={image.url || i}>
                <a href={image.url} target="_blank" rel="noreferrer">
                  <img src={image.url} alt={t('devis.demandes.imageN', { n: i + 1 })} loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className={styles.section} onSubmit={enregistrer} noValidate aria-label={t('devis.demandes.reponse')}>
        <h3 className={styles.titreCarte}>{t('devis.demandes.reponse')}</h3>
        <Champ libelle={t('devis.demandes.etat')} name="etat" value={etat} erreur={champs.etat}
          options={ETATS_RENDU.map((c) => [c, t(`devis.demandes.etats.${c}`)])} onChange={(e) => setEtat(e.target.value)} />
        <Champ libelle={t('devis.demandes.reponseLibelle')} name="reponse_equipe" multiligne rows={4} value={reponse}
          erreur={champs.reponse_equipe} aide={t('devis.demandes.reponseAide')} onChange={(e) => setReponse(e.target.value)} />
        {erreur && !champs.etat && !champs.reponse_equipe && <MessageErreur erreur={erreur} />}
        <div><Bouton type="submit" chargement={envoi}>{t('devis.demandes.enregistrer')}</Bouton></div>
        <p role="status" aria-live="polite" className={annonce ? styles.avertissement : 'visuellement-cache'}>{annonce}</p>
      </form>

      <section className={styles.section} aria-labelledby="rendu-devis">
        <h3 id="rendu-devis" className={styles.titreCarte}>{t('devis.demandes.devis')}</h3>
        {(demande.devis || []).length > 0 && (
          <ul>
            {demande.devis.map((d) => (
              <li key={d.id}>
                <Link to={`/devis/${d.id}`}>{d.reference}</Link> <PastilleDevis etat={d.etat} expire={d.expire} /> {fcfa(d.total)}
              </li>
            ))}
          </ul>
        )}
        {commandeId ? (
          <div>
            <Bouton as={Link} to={`/devis/nouveau?commande=${commandeId}&demande=${demande.id}`} variante="contour">
              {t('devis.demandes.creerDevis')}
            </Bouton>
          </div>
        ) : (
          <p className={styles.vide}>{t('devis.demandes.sansCommande')}</p>
        )}
      </section>

      <NotesInternes valeur={demande.notes_internes}
        surEnregistrement={(texte) => modifierDemandeRendu(demande.id, { notes_internes: texte })} />
    </>
  );
}

export default function TiroirDemandeRendu({ id, reference, surFermeture, surMiseAJour }) {
  const { t } = useTraduction();
  const { donnees, chargement, erreur, recharger } = useChargement((signal) => obtenirDemandeRendu(id, { signal }), [id]);
  return (
    <Tiroir ouvert large titre={t('devis.demandes.titreTiroir', { reference: donnees?.reference || reference })}
      surFermeture={surFermeture}>
      {chargement ? <Chargement texte={t('devis.demandes.chargementDetail')} />
        : erreur ? <MessageErreur erreur={erreur} reessayer={recharger} />
          : <Contenu demande={donnees} surMiseAJour={surMiseAJour} />}
    </Tiroir>
  );
}
