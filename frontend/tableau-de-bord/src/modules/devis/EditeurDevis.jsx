// BF-11, BF-12 : éditeur de devis (/devis/nouveau?commande=<id> et /devis/:id).
// Trois types de ligne (matériau, surface, forfait). L'aperçu (quantités, montants, total) vient du serveur
// (`POST calculer/`, après un court délai de saisie) : le front ne recopie pas la formule de calcul.
// Lecture seule dès que le devis n'est plus un brouillon.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { date, fcfa, surface } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { erreursChamps } from '@/app/api.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import ConfirmerAction from '@/composants/ConfirmerAction.jsx';
import { repartirErreur } from '@/composants/envoi.js';
import { PastilleDevis } from '@/composants/PastilleEtat.jsx';
import useChargement from '@/composants/useChargement.js';
import { useTraduction } from '@/i18n/index.js';

import { creerDevis, envoyerDevis, listerProduitsDuCatalogue, modifierDevis, supprimerDevis } from './api.js';
import LigneEditable from './composants/LigneEditable.jsx';
import { avecPrixCatalogue, erreursLignes, kilos, ligneVide, versCorps, versSaisie } from './lignes.js';
import { useApercu, useDevisEtCommande } from './useDevis.js';
import styles from './Devis.module.css';

const CHAMPS_FORMULAIRE = ['validite_jours', 'notes', 'lignes'];

function LectureSeule({ devis }) {
  const { t } = useTraduction();
  return (
    <section className={`carte ${styles.carte}`} aria-labelledby="titre-lignes-devis">
      <h2 id="titre-lignes-devis" className={styles.titreCarte}>{t('devis.editeur.lignes')}</h2>
      <div className={styles.defilement}>
        <table className={styles.tableauSimple}>
          <caption className="visuellement-cache">{t('devis.editeur.legendeLignes')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('devis.editeur.libelle')}</th>
              <th scope="col">{t('devis.editeur.type')}</th>
              <th scope="col">{t('devis.editeur.quantite')}</th>
              <th scope="col">{t('devis.editeur.montant')}</th>
            </tr>
          </thead>
          <tbody>
            {(devis.lignes || []).map((l, i) => (
              <tr key={l.ordre ?? i}>
                <td>{l.libelle}</td>
                <td>{t(`devis.editeur.types.${l.type_ligne}`)}</td>
                <td>{l.type_ligne === 'materiau' ? kilos(l.quantite_kg) : '—'}</td>
                <td>{fcfa(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.totalMontant}>{t('devis.editeur.total')} : {fcfa(devis.total)}</p>
      {devis.notes && <p className={styles.texteClient}>{devis.notes}</p>}
    </section>
  );
}

export default function EditeurDevis() {
  const { t } = useTraduction();
  const { id } = useParams();
  const [parametres] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const commandeUrl = parametres.get('commande') || '';
  const demandeUrl = parametres.get('demande') || '';

  const { devis, commande, commandeId } = useDevisEtCommande({ id, commandeId: commandeUrl });
  const produitsEtat = useChargement((signal) => listerProduitsDuCatalogue({ signal }).catch(() => []), []);
  const produits = produitsEtat.donnees || [];

  const [form, setForm] = useState({ validite_jours: '30', notes: '' });
  const [lignes, setLignes] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [annonce, setAnnonce] = useState(state?.annonce || '');
  const initialise = useRef(false);

  const brouillon = !id || devis.donnees?.etat === 'brouillon';
  usePageMeta(devis.donnees?.reference || t('devis.editeur.nouveau'));

  // Un devis existant remplit le formulaire ; un nouveau devis part des lignes de la commande (produit, surface).
  useEffect(() => {
    if (initialise.current) return;
    if (id && devis.donnees) {
      initialise.current = true;
      setForm({ validite_jours: String(devis.donnees.validite_jours ?? '30'), notes: devis.donnees.notes || '' });
      setLignes((devis.donnees.lignes || []).map(versSaisie));
    } else if (!id && !commande.chargement && !produitsEtat.chargement) {
      initialise.current = true;
      const surfaceCommande = commande.donnees?.surface_m2 != null ? String(commande.donnees.surface_m2) : '';
      setLignes((commande.donnees?.lignes || []).filter((l) => l.produit).map((l) => {
        const produit = produits.find((p) => p.id === l.produit.id);
        return avecPrixCatalogue(ligneVide('materiau', { produit: String(l.produit.id), surface_m2: surfaceCommande }), produit);
      }));
    }
  }, [id, devis.donnees, commande.donnees, commande.chargement, produitsEtat.chargement, produits]);

  const { apercu, erreursParLigne, erreurGenerale, calcul } = useApercu(lignes, { actif: brouillon && initialise.current });
  const retourServeur = erreursLignes(erreur);
  const champs = erreursChamps(erreur);
  const generale = erreur ? repartirErreur(erreur, CHAMPS_FORMULAIRE).generale : null;

  const changerLigne = (cle, changements) => setLignes((liste) => liste.map((l) => {
    if (l.cle !== cle) return l;
    const suivante = { ...l, ...changements };
    // Un produit choisi (ou un type changé) préremplit le prix du catalogue, seulement s'il existe.
    if ('produit' in changements || 'type_ligne' in changements) {
      return avecPrixCatalogue(suivante, produits.find((p) => String(p.id) === suivante.produit));
    }
    return suivante;
  }));
  const ajouter = (type) => setLignes((liste) => [...liste, ligneVide(type)]);
  const retirer = (cle) => setLignes((liste) => liste.filter((l) => l.cle !== cle));
  const deplacer = (index, sens) => setLignes((liste) => {
    const copie = [...liste];
    const cible = index + sens;
    if (cible < 0 || cible >= copie.length) return liste;
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    return copie;
  });

  /** Enregistre le brouillon (création ou modification) et renvoie le devis du serveur. */
  async function enregistrer() {
    const corps = { validite_jours: Number(form.validite_jours) || undefined, notes: form.notes, lignes: lignes.map(versCorps) };
    if (id) return modifierDevis(id, corps);
    return creerDevis({ commande: Number(commandeId), ...(demandeUrl ? { demande: Number(demandeUrl) } : {}), ...corps });
  }

  async function surEnregistrement(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    setAnnonce('');
    try {
      const enregistre = await enregistrer();
      if (!id) {
        navigate(`/devis/${enregistre.id}`, { replace: true, state: { annonce: t('devis.editeur.cree') } });
      } else {
        devis.setDonnees(enregistre);
        setAnnonce(t('devis.editeur.enregistre'));
      }
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyer() {
    setErreur(null);
    try {
      const enregistre = await enregistrer();
      const envoye = await envoyerDevis(enregistre.id);
      if (id) {
        devis.setDonnees(envoye);
        setAnnonce(t('devis.editeur.envoye'));
      } else {
        navigate(`/devis/${enregistre.id}`, { replace: true, state: { annonce: t('devis.editeur.envoye') } });
      }
    } catch (err) {
      // L'erreur s'affiche dans la confirmation (et sous les champs du formulaire).
      setErreur(err);
      throw err;
    }
  }

  if ((id && devis.chargement) || (!id && commandeUrl && commande.chargement)) return <Chargement texte={t('devis.editeur.chargement')} />;
  if (id && devis.erreur?.statut === 404) {
    return (
      <EtatVide titre={t('devis.editeur.introuvable')} niveau={1}
        action={<Bouton as={Link} to="/devis" variante="contour">{t('devis.editeur.retour')}</Bouton>}>
        {t('devis.editeur.introuvableTexte')}
      </EtatVide>
    );
  }
  if (id && devis.erreur) {
    return <div className={styles.page}><MessageErreur erreur={devis.erreur} reessayer={devis.recharger} /></div>;
  }
  if (!id && !commandeUrl) {
    return (
      <EtatVide titre={t('devis.editeur.commandeManquante')} niveau={1}
        action={<Bouton as={Link} to="/commandes" variante="contour">{t('devis.editeur.versCommandes')}</Bouton>}>
        {t('devis.editeur.commandeManquanteTexte')}
      </EtatVide>
    );
  }

  const detail = devis.donnees;
  const cmd = commande.donnees;
  const referenceCommande = cmd?.reference || detail?.commande_reference;
  const peutEnvoyer = brouillon && lignes.length > 0 && !calcul && apercu?.complet === true && Number(apercu.total) > 0;

  return (
    <div className={styles.page}>
      <Link to={commandeId ? `/commandes/${commandeId}` : '/devis'} className={styles.retour}>
        <Icone nom="retour" taille={18} /> {commandeId ? t('devis.editeur.retourCommande') : t('devis.editeur.retour')}
      </Link>
      <div>
        <h1 className="titre-page">{detail?.reference || t('devis.editeur.nouveau')}</h1>
        <div className={styles.pastilles}>
          {detail && <PastilleDevis etat={detail.etat} expire={detail.expire} />}
          {referenceCommande && (
            <span>{t('devis.editeur.pourCommande')} <Link to={`/commandes/${commandeId}`}>{referenceCommande}</Link>
              {cmd?.client?.nom_complet && ` · ${cmd.client.nom_complet}`}
              {cmd?.surface_m2 != null && ` · ${surface(cmd.surface_m2)}`}</span>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className={annonce ? 'carte' : 'visuellement-cache'}>{annonce}</p>

      {!brouillon && (
        <>
          <p className={styles.avertissement}>{t('devis.editeur.lectureSeule')}</p>
          {detail.valide_jusqu_au && (
            <p>{t('devis.editeur.valideJusquAu', { date: date(detail.valide_jusqu_au) })}</p>
          )}
          <LectureSeule devis={detail} />
        </>
      )}

      {brouillon && (
        <form onSubmit={surEnregistrement} noValidate className={styles.page} aria-label={t('devis.editeur.formulaire')}>
          <section className={`carte ${styles.carte}`}>
            <h2 className={styles.titreCarte}>{t('devis.editeur.conditions')}</h2>
            <div className={styles.grille}>
              <Champ libelle={t('devis.editeur.validite')} name="validite_jours" inputMode="numeric" value={form.validite_jours}
                erreur={champs.validite_jours} onChange={(e) => setForm((f) => ({ ...f, validite_jours: e.target.value }))} />
            </div>
            <Champ libelle={t('devis.editeur.notes')} name="notes" multiligne rows={3} maxLength={1000} value={form.notes}
              erreur={champs.notes} aide={t('devis.editeur.aideNotes')}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </section>

          <section className={`carte ${styles.carte}`} aria-labelledby="titre-lignes-edition">
            <h2 id="titre-lignes-edition" className={styles.titreCarte}>{t('devis.editeur.lignes')}</h2>
            {lignes.length === 0 && <p className={styles.vide}>{t('devis.editeur.aucuneLigne')}</p>}
            <ol className={styles.lignes}>
              {lignes.map((l, i) => (
                <li key={l.cle}>
                  <LigneEditable ligne={l} index={i} total={lignes.length} produits={produits}
                    erreurs={{ ...(erreursParLigne[i] || {}), ...(retourServeur.parLigne[i] || {}) }}
                    calcule={apercu?.lignes?.[i]}
                    surChangement={(c) => changerLigne(l.cle, c)} surRetrait={() => retirer(l.cle)}
                    surDeplacement={(sens) => deplacer(i, sens)} />
                </li>
              ))}
            </ol>
            {retourServeur.generale && <p role="alert" className={styles.erreursLigne}>{retourServeur.generale}</p>}
            <div className={styles.ajout}>
              <Bouton variante="contour" onClick={() => ajouter('materiau')}>{t('devis.editeur.ajouterMateriau')}</Bouton>
              <Bouton variante="contour" onClick={() => ajouter('surface')}>{t('devis.editeur.ajouterSurface')}</Bouton>
              <Bouton variante="contour" onClick={() => ajouter('forfait')}>{t('devis.editeur.ajouterForfait')}</Bouton>
            </div>
          </section>

          <section className={`carte ${styles.carte}`} aria-labelledby="titre-total">
            <h2 id="titre-total" className="visuellement-cache">{t('devis.editeur.total')}</h2>
            <div className={styles.total} aria-live="polite">
              <span>{t('devis.editeur.total')}</span>
              <strong className={styles.totalMontant}>{apercu ? fcfa(apercu.total) : '—'}</strong>
            </div>
            <p className={styles.aideTotal}>
              {calcul ? t('devis.editeur.calcul')
                : !lignes.length ? t('devis.editeur.aucuneLigne')
                  : apercu && apercu.complet === false ? t('devis.editeur.incomplet')
                    : t('devis.editeur.aideTotal')}
            </p>
            {erreurGenerale && !erreursLignes(erreurGenerale).parLigne.length && <MessageErreur erreur={erreurGenerale} />}
          </section>

          {generale && <MessageErreur erreur={generale} />}

          <div className={styles.actions}>
            <Bouton type="submit" chargement={envoi}>{t('devis.editeur.enregistrer')}</Bouton>
            <ConfirmerAction libelle={t('devis.editeur.envoyerAuClient')} variante="contour" desactive={!peutEnvoyer}
              question={t('devis.editeur.confirmerEnvoi', { total: apercu ? fcfa(apercu.total) : '—' })}
              libelleConfirmer={t('devis.editeur.confirmerEnvoiBouton')} surConfirmation={envoyer} />
            {id && (
              <BoutonSupprimer nom={detail.reference} libelle={t('devis.editeur.supprimer')}
                surConfirmation={async () => { await supprimerDevis(id); navigate('/devis', { replace: true }); }} />
            )}
          </div>
          {!peutEnvoyer && <p className={styles.aideTotal}>{t('devis.editeur.envoyerImpossible')}</p>}
        </form>
      )}
    </div>
  );
}
