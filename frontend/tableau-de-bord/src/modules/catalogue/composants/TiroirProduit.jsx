// Fiche d'un produit dans un tiroir : textes traduits (onglets de langues), famille, prix facultatif et unité,
// usages, mise en ligne, caractéristiques, plan de coupe ; puis photos et designs une fois le produit créé.
import { useEffect, useId, useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { prix as formatPrix, UNITES } from '@partage/utils/format.js';

import { t as traduire, useTraduction } from '@/i18n/index.js';
import BoutonSupprimer from '@/composants/BoutonSupprimer.jsx';
import { lirePrix, repartirErreur } from '@/composants/envoi.js';
import OngletsLangues, { PastilleTraductions } from '@/composants/OngletsLangues.jsx';
import Tiroir from '@/composants/Tiroir.jsx';
import { CODES_USAGES, libelleUsage } from '@/composants/usages.js';
import gestion from '@/composants/Gestion.module.css';

import { creerProduit, modifierProduit, supprimerProduit } from '../api.js';
import { useProduit } from '../useCatalogue.js';
import EditeurCaracteristiques, { CHAMPS_CARACTERISTIQUE } from './EditeurCaracteristiques.jsx';
import EditeurCouches, { CHAMPS_COUCHE } from './EditeurCouches.jsx';
import { depuisLignes, versLignes } from './EditeurLignes.jsx';
import GestionDesigns from './GestionDesigns.jsx';
import GestionImages from './GestionImages.jsx';

/** Champs traduits du produit (contrat d'API), dans l'ordre du formulaire. */
export const TEXTES_PRODUIT = [
  'nom', 'accroche', 'description', 'domaine_application', 'performances', 'preparation', 'methode_application',
  'dosage', 'conditions_chantier',
];
const CHAMPS_USAGE = CODES_USAGES.map((code) => `pour_${code}`);
const CHAMPS_ENVOYES = [
  'famille', 'reference', ...TEXTES_PRODUIT, ...CHAMPS_USAGE, 'prix', 'unite_prix', 'en_ligne', 'a_la_une', 'est_nouveau',
  'ordre', 'traductions', 'caracteristiques', 'couches',
];

/** Produit du serveur (ou rien) → état du formulaire. */
export function versFormulaire(produit, familleParDefaut = '') {
  return {
    famille: produit?.famille != null ? String(produit.famille?.id ?? produit.famille) : String(familleParDefaut || ''),
    reference: produit?.reference || '',
    ...Object.fromEntries(TEXTES_PRODUIT.map((c) => [c, produit?.[c] || ''])),
    ...Object.fromEntries(CHAMPS_USAGE.map((c) => [c, Boolean(produit?.[c])])),
    prix: produit?.prix != null ? String(produit.prix) : '',
    unite_prix: produit?.unite_prix || 'm2',
    en_ligne: produit ? Boolean(produit.en_ligne) : true,
    a_la_une: Boolean(produit?.a_la_une),
    est_nouveau: Boolean(produit?.est_nouveau),
    ordre: String(produit?.ordre ?? 0),
    traductions: produit?.traductions || {},
    caracteristiques: versLignes(produit?.caracteristiques, CHAMPS_CARACTERISTIQUE),
    couches: versLignes(produit?.couches, CHAMPS_COUCHE),
  };
}

/** Contrôles avant l'envoi (le serveur vérifie aussi le prix et l'unité). */
export function validerProduit(form) {
  const erreurs = {};
  if (!form.nom.trim()) erreurs.nom = traduire('catalogue.produit.nomManquant');
  if (!form.famille) erreurs.famille = traduire('catalogue.produit.familleManquante');
  const prix = lirePrix(form.prix);
  if (Number.isNaN(prix) || (prix !== null && prix < 0)) erreurs.prix = traduire('catalogue.produit.prixInvalide');
  if (form.accroche.length > 200) erreurs.accroche = traduire('catalogue.produit.accrocheLongue');
  return erreurs;
}

/** État du formulaire → corps JSON envoyé au serveur. */
export function versDonnees(form) {
  const prix = lirePrix(form.prix);
  return {
    famille: Number(form.famille),
    reference: form.reference.trim(),
    ...Object.fromEntries(TEXTES_PRODUIT.map((c) => [c, form[c].trim()])),
    ...Object.fromEntries(CHAMPS_USAGE.map((c) => [c, form[c]])),
    prix,
    unite_prix: form.unite_prix,
    en_ligne: form.en_ligne,
    a_la_une: form.a_la_une,
    est_nouveau: form.est_nouveau,
    ordre: Number.parseInt(form.ordre, 10) || 0,
    traductions: form.traductions,
    caracteristiques: depuisLignes(form.caracteristiques, CHAMPS_CARACTERISTIQUE),
    couches: depuisLignes(form.couches, CHAMPS_COUCHE),
  };
}

function Case({ nom, libelle, valeur, surChangement }) {
  return (
    <label className={gestion.case}>
      <input type="checkbox" name={nom} checked={valeur} onChange={(e) => surChangement(nom, e.target.checked)} />
      {libelle}
    </label>
  );
}

/** `produitId` : id d'un produit existant, 'nouveau' pour une création, null : tiroir fermé. */
export default function TiroirProduit({ produitId, familles, surFermeture, surEnregistrement, surSuppression }) {
  const { t } = useTraduction();
  const [idInitial] = useState(produitId === 'nouveau' ? null : produitId);
  const [id, setId] = useState(idInitial);
  // Seul le produit ouvert est chargé ; après une création, la réponse du serveur suffit.
  const { donnees: produitCharge, chargement, erreur: erreurChargement, recharger } = useProduit(idInitial);
  const [produit, setProduit] = useState(null);
  const [form, setForm] = useState(() => versFormulaire(null, familles[0]?.id));
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [annonce, setAnnonce] = useState('');
  const idForm = useId();

  useEffect(() => {
    if (produitCharge) {
      setProduit(produitCharge);
      setForm(versFormulaire(produitCharge));
    }
  }, [produitCharge]);

  const changer = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }));
  const champTexte = (nom, extra = {}) => ({ nom, libelle: t(`catalogue.produit.${nom}`), ...extra });

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerProduit(form);
    setErreurs(locales);
    setErreur(null);
    setAnnonce('');
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      const resultat = id ? await modifierProduit(id, versDonnees(form)) : await creerProduit(versDonnees(form));
      setProduit(resultat);
      setForm(versFormulaire(resultat));
      setId(resultat.id);
      setAnnonce(id ? t('catalogue.produit.enregistre') : t('catalogue.produit.cree'));
      surEnregistrement?.(resultat);
    } catch (err) {
      const { champs, generale } = repartirErreur(err, CHAMPS_ENVOYES);
      setErreurs(champs);
      setErreur(generale);
    } finally {
      setEnvoi(false);
    }
  }

  const mettreAJour = (changements) => {
    const nouveau = { ...produit, ...changements };
    setProduit(nouveau);
    surEnregistrement?.(nouveau);
  };

  const titre = id ? (produit?.nom || t('catalogue.produit.titreModifier')) : t('catalogue.produit.titreNouveau');
  const prixAffiche = Number.isNaN(lirePrix(form.prix)) ? '' : formatPrix(lirePrix(form.prix), form.unite_prix);

  return (
    <Tiroir ouvert titre={titre} large surFermeture={surFermeture}
      sousTitre={produit?.reference || undefined}
      pied={!(chargement && idInitial) && !erreurChargement ? (
        <>
          <Bouton type="submit" form={idForm} chargement={envoi}>
            {id ? t('actions.enregistrer') : t('catalogue.produit.creer')}
          </Bouton>
          <Bouton variante="texte" onClick={surFermeture}>{t('actions.fermer')}</Bouton>
          {id && (
            <span style={{ marginLeft: 'auto' }}>
              <BoutonSupprimer nom={produit?.nom || ''} surConfirmation={async () => {
                await supprimerProduit(id);
                surSuppression?.(id);
              }} />
            </span>
          )}
        </>
      ) : null}>
      {chargement && idInitial ? (
        <Chargement texte={t('catalogue.produit.chargement')} />
      ) : erreurChargement ? (
        <MessageErreur erreur={erreurChargement} reessayer={recharger} />
      ) : (
        <>
          <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
          {annonce && <p className={gestion.succes}>{annonce}</p>}
          {produit && <PastilleTraductions langues={produit.langues_incompletes} />}

          <form id={idForm} className={gestion.formulaire} onSubmit={envoyer} noValidate
            aria-label={titre}>
            <fieldset className={gestion.bloc}>
              <legend>{t('catalogue.produit.general')}</legend>
              <div className={gestion.grille}>
                <Champ libelle={t('catalogue.produit.famille')} name="famille" value={form.famille} required
                  onChange={(e) => changer('famille', e.target.value)} erreur={erreurs.famille}
                  options={[['', t('catalogue.produit.choisirFamille')], ...familles.map((f) => [String(f.id), f.nom])]} />
                <Champ libelle={t('catalogue.produit.reference')} name="reference" value={form.reference}
                  placeholder="YD-500" onChange={(e) => changer('reference', e.target.value)} erreur={erreurs.reference} />
                <Champ libelle={t('catalogue.produit.ordre')} name="ordre" type="number" min="0" value={form.ordre}
                  onChange={(e) => changer('ordre', e.target.value)} erreur={erreurs.ordre} />
              </div>
              <div className={gestion.cases}>
                <Case nom="en_ligne" libelle={t('catalogue.produit.enLigne')} valeur={form.en_ligne} surChangement={changer} />
                <Case nom="a_la_une" libelle={t('catalogue.produit.aLaUne')} valeur={form.a_la_une} surChangement={changer} />
                <Case nom="est_nouveau" libelle={t('catalogue.produit.nouveau')} valeur={form.est_nouveau} surChangement={changer} />
              </div>
            </fieldset>

            <fieldset className={gestion.bloc}>
              <legend>{t('catalogue.produit.textes')}</legend>
              <OngletsLangues contexteIA="produit" valeurs={form} traductions={form.traductions} erreurs={erreurs}
                surChangement={changer} surTraductions={(traductions) => changer('traductions', traductions)}
                champs={[
                  champTexte('nom', { required: true }),
                  champTexte('accroche', { maxLength: 200, aide: t('catalogue.produit.aideAccroche') }),
                  champTexte('description', { multiligne: true }),
                  champTexte('domaine_application', { multiligne: true }),
                  champTexte('performances', { multiligne: true }),
                  champTexte('preparation', { multiligne: true }),
                  champTexte('methode_application', { multiligne: true }),
                  champTexte('dosage', { multiligne: true }),
                  champTexte('conditions_chantier', { multiligne: true }),
                ]} />
            </fieldset>

            <fieldset className={gestion.bloc}>
              <legend>{t('catalogue.produit.prixTitre')}</legend>
              <div className={gestion.grille}>
                <Champ libelle={t('catalogue.produit.prix')} name="prix" inputMode="numeric" value={form.prix}
                  onChange={(e) => changer('prix', e.target.value)} erreur={erreurs.prix}
                  aide={t('catalogue.produit.aidePrix')} />
                <Champ libelle={t('catalogue.produit.unite')} name="unite_prix" value={form.unite_prix}
                  onChange={(e) => changer('unite_prix', e.target.value)} erreur={erreurs.unite_prix}
                  options={Object.keys(UNITES).map((u) => [u, UNITES[u]])} />
              </div>
              {prixAffiche && <p className={gestion.aide}>{t('catalogue.produit.apercuPrix', { prix: prixAffiche })}</p>}
            </fieldset>

            <fieldset className={gestion.bloc}>
              <legend>{t('catalogue.produit.usages')}</legend>
              <div className={gestion.cases}>
                {CODES_USAGES.map((code) => (
                  <Case key={code} nom={`pour_${code}`} libelle={libelleUsage(code)} valeur={form[`pour_${code}`]}
                    surChangement={changer} />
                ))}
              </div>
            </fieldset>

            <EditeurCaracteristiques lignes={form.caracteristiques} erreur={erreurs.caracteristiques}
              surChangement={(lignes) => changer('caracteristiques', lignes)} />
            <EditeurCouches lignes={form.couches} erreur={erreurs.couches}
              surChangement={(lignes) => changer('couches', lignes)} />

            <MessageErreur erreur={erreur} />
          </form>

          {id && produit ? (
            <>
              <GestionImages produitId={id} images={produit.images} surChangement={(images) => mettreAJour({ images })} />
              <GestionDesigns produitId={id} designs={produit.designs} surChangement={(designs) => mettreAJour({ designs })} />
            </>
          ) : (
            <p className={gestion.aide}>{t('catalogue.produit.mediasApres')}</p>
          )}
        </>
      )}
    </Tiroir>
  );
}
