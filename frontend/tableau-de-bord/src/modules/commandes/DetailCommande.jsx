// BF-10, BF-12, BF-13, BF-16 : détail d'une commande pour l'équipe.
// Les boutons d'étape suivent `actions_possibles` et les réponses aux propositions `peut_repondre` : le serveur
// décide, le front ne déduit jamais une transition. « En négociation » et « Contrat signé » ne se posent pas à la main.
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { infosLangue } from '@partage/i18n/langues.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { dateHeure, fcfa, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { erreursChamps } from '@/app/api.js';
import ConfirmerAction from '@/composants/ConfirmerAction.jsx';
import LiensContact from '@/composants/LiensContact.jsx';
import NotesInternes from '@/composants/NotesInternes.jsx';
import { PastilleEtape, PastilleUrgente } from '@/composants/PastilleEtat.jsx';
import { useTraduction } from '@/i18n/index.js';

import { changerEtat, modifierCommande } from './api.js';
import ContratCommande from './composants/ContratCommande.jsx';
import DevisLies from './composants/DevisLies.jsx';
import FriseEtapes from './composants/FriseEtapes.jsx';
import PanneauNegociation from './composants/PanneauNegociation.jsx';
import { useCommande } from './useCommandes.js';
import styles from './Commandes.module.css';

function Info({ libelle, children }) {
  return <div className={styles.info}><dt>{libelle}</dt><dd>{children || '—'}</dd></div>;
}

/** Surface du chantier : modifiable tant que le serveur l'autorise (`modifier` dans actions_possibles). */
function FormulaireSurface({ commande, surDetail, annoncer }) {
  const { t } = useTraduction();
  const [valeur, setValeur] = useState(commande.surface_m2 != null ? String(commande.surface_m2) : '');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const champs = erreursChamps(erreur);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const texte = valeur.trim().replace(',', '.');
      const detail = await modifierCommande(commande.id, { surface_m2: texte === '' ? null : texte });
      surDetail(detail);
      annoncer(t('commandes.surface.enregistree'));
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={enregistrer} noValidate>
      <div className={styles.formSurface}>
        <Champ libelle={t('commandes.surface.libelle')} name="surface_m2" inputMode="decimal" value={valeur}
          onChange={(e) => setValeur(e.target.value)} erreur={champs.surface_m2} aide={t('commandes.surface.aide')} />
        <Bouton type="submit" variante="contour" chargement={envoi}>{t('commandes.surface.enregistrer')}</Bouton>
      </div>
      {erreur && !champs.surface_m2 && <MessageErreur erreur={erreur} />}
    </form>
  );
}

function BoutonsEtape({ commande, surDetail, annoncer }) {
  const { t } = useTraduction();
  const actions = commande.actions_possibles || [];
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function poser(etat, motif, texteAnnonce) {
    const detail = await changerEtat(commande.id, etat, motif);
    surDetail(detail);
    annoncer(texteAnnonce);
  }

  async function demarrer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await poser('travaux', undefined, t('commandes.etape.travauxAnnonce'));
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (!actions.some((a) => ['demarrer_travaux', 'terminer', 'annuler'].includes(a))) return null;
  return (
    <div>
      <div className={styles.actions}>
        {actions.includes('demarrer_travaux') && (
          <Bouton chargement={envoi} onClick={demarrer}>{t('commandes.etape.demarrer')}</Bouton>
        )}
        {actions.includes('terminer') && (
          <ConfirmerAction libelle={t('commandes.etape.terminer')} variante="plein"
            question={t('commandes.etape.confirmerTerminer')} libelleConfirmer={t('commandes.etape.confirmerTerminerBouton')}
            surConfirmation={() => poser('terminee', undefined, t('commandes.etape.termineeAnnonce'))} />
        )}
        {actions.includes('annuler') && (
          <ConfirmerAction libelle={t('commandes.etape.annuler')}
            question={t('commandes.etape.confirmerAnnuler')} libelleConfirmer={t('commandes.etape.confirmerAnnulerBouton')}
            champ={{ libelle: t('commandes.etape.motif'), nom: 'motif', max: 500 }}
            surConfirmation={(motif) => poser('annulee', motif, t('commandes.etape.annuleeAnnonce'))} />
        )}
      </div>
      {erreur && <MessageErreur erreur={erreur} />}
    </div>
  );
}

export default function DetailCommande() {
  const { t } = useTraduction();
  const { id } = useParams();
  const { state } = useLocation();
  const retour = typeof state?.retour === 'string' && state.retour.startsWith('/commandes') ? state.retour : '/commandes';
  const { commande, chargement, erreur, recharger, remplacer, actualiser } = useCommande(id);
  const [annonce, setAnnonce] = useState('');
  usePageMeta(commande?.reference || t('commandes.detail.meta'));

  const lienRetour = (
    <Link to={retour} className={styles.retour}><Icone nom="retour" taille={18} /> {t('commandes.detail.retour')}</Link>
  );

  if (chargement) return <Chargement texte={t('commandes.detail.chargement')} />;
  if (erreur?.statut === 404) {
    return (
      <EtatVide titre={t('commandes.detail.introuvable')} niveau={1}
        action={<Bouton as={Link} to="/commandes" variante="contour">{t('commandes.detail.retour')}</Bouton>}>
        {t('commandes.detail.introuvableTexte')}
      </EtatVide>
    );
  }
  if (erreur || !commande) {
    return <div className={styles.page}>{lienRetour}<MessageErreur erreur={erreur} reessayer={recharger} /></div>;
  }

  const client = commande.client || {};
  const adresse = commande.adresse || {};
  const langue = client.langue ? infosLangue(client.langue).nom : '';
  const actions = commande.actions_possibles || [];
  const ouverte = !['terminee', 'annulee'].includes(commande.etat);
  const surDetail = (detail) => remplacer((ancien) => ({ ...ancien, ...detail }));

  return (
    <div className={styles.page}>
      {lienRetour}
      <div className={styles.enteteDetail}>
        <h1 className="titre-page">{commande.reference}</h1>
        <div className={styles.pastilles}>
          <PastilleEtape etat={commande.etat} />
          {commande.action_requise && <PastilleUrgente>{t('commandes.actionRequiseCourt')}</PastilleUrgente>}
          <span>{t(`commandes.types.${commande.type_batiment}`)}</span>
          <span>{t('commandes.detail.creeLe', { date: dateHeure(commande.cree_le) })}</span>
        </div>
      </div>

      <p role="status" aria-live="polite" className={annonce ? 'carte' : 'visuellement-cache'}>{annonce}</p>

      <section className={`carte ${styles.carte}`} aria-labelledby="titre-etapes">
        <h2 id="titre-etapes" className={styles.titreCarte}>{t('commandes.etape.titre')}</h2>
        <FriseEtapes etat={commande.etat} historique={commande.historique} creeLe={commande.cree_le} />
        <BoutonsEtape commande={commande} surDetail={surDetail} annoncer={setAnnonce} />
      </section>

      <div className={styles.colonnes}>
        <div className={styles.colonne}>
          <PanneauNegociation commande={commande} surMiseAJour={actualiser} surDetail={surDetail} annoncer={setAnnonce} />
          <ContratCommande contrat={commande.contrat} />
          <DevisLies commandeId={commande.id} devis={commande.devis} peutCreer={ouverte} />
        </div>

        <div className={styles.colonne}>
          <section className={`carte ${styles.carte}`} aria-labelledby="titre-client">
            <h2 id="titre-client" className={styles.titreCarte}>{t('commandes.client.titre')}</h2>
            <dl className={styles.infos}>
              <Info libelle={t('commandes.client.nom')}>
                {client.id ? <Link to={`/clients/${client.id}`}>{client.nom_complet}</Link> : client.nom_complet}
              </Info>
              <Info libelle={t('commandes.client.coordonnees')}>
                <LiensContact email={client.email} telephone={client.telephone} />
              </Info>
              <Info libelle={t('commandes.client.langue')}>
                {langue && <>{langue}<small> {t('commandes.client.repondreEn', { langue })}</small></>}
              </Info>
              <Info libelle={t('commandes.client.adresseClient')}>
                {[client.rue_ou_repere, client.quartier, client.ville].filter(Boolean).join(', ')}
              </Info>
              <Info libelle={t('commandes.client.adresseChantier')}>
                {[adresse.rue_ou_repere, adresse.quartier, adresse.ville].filter(Boolean).join(', ')}
              </Info>
            </dl>
          </section>

          <section className={`carte ${styles.carte}`} aria-labelledby="titre-chantier">
            <h2 id="titre-chantier" className={styles.titreCarte}>{t('commandes.chantier.titre')}</h2>
            <dl className={styles.infos}>
              <Info libelle={t('commandes.chantier.type')}>{t(`commandes.types.${commande.type_batiment}`)}</Info>
              <Info libelle={t('commandes.chantier.surface')}>{surface(commande.surface_m2)}</Info>
              <Info libelle={t('commandes.chantier.montant')}>{commande.montant_convenu != null ? fcfa(commande.montant_convenu) : ''}</Info>
              <Info libelle={t('commandes.chantier.delai')}>
                {commande.delai_convenu_jours != null ? t('commandes.jours', { n: commande.delai_convenu_jours }) : ''}
              </Info>
            </dl>
            {actions.includes('modifier') && (
              <FormulaireSurface key={String(commande.surface_m2)} commande={commande} surDetail={surDetail} annoncer={setAnnonce} />
            )}
            {commande.description && (
              <div>
                <h3 className={styles.titreCarte}>{t('commandes.chantier.description')}</h3>
                <p className={styles.texteClient}>{commande.description}</p>
              </div>
            )}
          </section>

          <section className={`carte ${styles.carte}`} aria-labelledby="titre-lignes">
            <h2 id="titre-lignes" className={styles.titreCarte}>{t('commandes.lignesTitre')}</h2>
            <div className={styles.defilement}>
              <table className={styles.tableauSimple}>
                <caption className="visuellement-cache">{t('commandes.lignesLegende')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('commandes.colonnesLignes.produit')}</th>
                    <th scope="col">{t('commandes.colonnesLignes.design')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(commande.lignes || []).map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.produit ? <>{l.produit.nom}<small> {l.produit.reference}</small></> : t('commandes.produitRetire')}
                      </td>
                      <td>
                        {l.design ? (
                          <>
                            {l.design.couleur && <span className={styles.pastilleCouleur} style={{ background: l.design.couleur }} aria-hidden="true" />}
                            {l.design.nom}
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`carte ${styles.carte}`}>
            <NotesInternes valeur={commande.notes_internes}
              surEnregistrement={(texte) => modifierCommande(commande.id, { notes_internes: texte })} />
          </section>
        </div>
      </div>
    </div>
  );
}
