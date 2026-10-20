// BF-10, BF-12 : paiement d'une commande (/commandes/:id/payer). Reprend un paiement en attente au rechargement ;
// au retour d'une redirection (?paiement=<id>), l'adresse n'est jamais crue : l'état vient du serveur.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import Icone from '@partage/ui/Icone.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import { fcfa } from '@partage/utils/format.js';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useCommande } from '@/modules/commandes/useCommandes.js';
import { useAuth } from '@/modules/compte/AuthContext.jsx';
import commandeStyles from '@/modules/commandes/Commandes.module.css';

import * as paiements from './api.js';
import FormulairePaiement from './composants/FormulairePaiement.jsx';
import SuiviPaiement from './composants/SuiviPaiement.jsx';
import { rediriger } from './navigation.js';
import { peutPayer, resteAPayer } from './regles.js';
import { useDisponibilite } from './usePaiements.js';
import styles from './Paiements.module.css';

/** Paiement à suivre : celui de l'adresse (?paiement=), sinon celui qui est resté en attente. Toujours lu auprès du serveur. */
function usePaiementARepartir(commandeId, idAdresse) {
  const [etat, setEtat] = useState({ chargement: true, paiement: null, introuvable: false });
  const [essai, setEssai] = useState(0);
  const [ignorer, setIgnorer] = useState(false);
  const adresse = ignorer ? '' : idAdresse;
  useEffect(() => {
    let actif = true;
    setEtat((e) => ({ ...e, chargement: true }));
    (async () => {
      try {
        let paiement = null;
        let introuvable = false;
        if (adresse && /^\d+$/.test(adresse)) {
          try {
            paiement = await paiements.detail(adresse);
            if (String(paiement?.commande?.id) !== String(commandeId)) paiement = null;
          } catch {
            introuvable = true;
          }
          if (!paiement) introuvable = true;
        }
        if (!paiement) {
          const liste = await paiements.lister({ commande: commandeId, etat: 'en_attente' });
          const premier = (liste?.results || [])[0];
          if (premier) paiement = await paiements.detail(premier.id).catch(() => premier);
        }
        if (actif) setEtat({ chargement: false, paiement, introuvable: introuvable && !paiement });
      } catch {
        if (actif) setEtat({ chargement: false, paiement: null, introuvable: false });
      }
    })();
    return () => {
      actif = false;
    };
  }, [commandeId, adresse, essai]);
  /** Relit les paiements en attente de la commande, sans tenir compte de l'adresse. */
  const relire = () => {
    setIgnorer(true);
    setEssai((n) => n + 1);
  };
  return { ...etat, relire };
}

export default function PaiementPage() {
  const { id } = useParams();
  const { t } = useTraduction();
  usePageMeta(t('paiements.page.titre'));
  const { utilisateur } = useAuth();
  const [parametres] = useSearchParams();
  const { commande, chargement, erreur, recharger } = useCommande(id);
  const dispo = useDisponibilite();
  const repris = usePaiementARepartir(id, parametres.get('paiement') || '');
  const [suivi, setSuivi] = useState(null);
  const [ecarte, setEcarte] = useState(null);

  const retour = (
    <Link to={`/commandes/${id}`} className={commandeStyles.retour}><Icone nom="retour" taille={18} />{t('paiements.page.retour')}</Link>
  );

  if (!commande) {
    if (erreur?.statut === 404) {
      return (
        <div className="conteneur section">
          <EtatVide titre={t('commandes.detail.introuvable.titre')} niveau={1}
            action={<Bouton as={Link} to="/commandes">{t('commandes.detail.retour')}</Bouton>}>
            {t('commandes.detail.introuvable.texte')}
          </EtatVide>
        </div>
      );
    }
    return (
      <div className="conteneur section">
        {retour}
        {chargement ? <Chargement plein /> : <MessageErreur erreur={erreur} reessayer={recharger} />}
      </div>
    );
  }

  const candidat = suivi || repris.paiement;
  const paiementAffiche = candidat && candidat.id !== ecarte ? candidat : null;
  const reste = resteAPayer(commande);

  function apresCreation(paiement) {
    if (paiement.mode === 'lien' && paiement.lien) {
      setSuivi(paiement);
      rediriger(paiement.lien);
      return;
    }
    setSuivi(paiement);
  }

  let contenu;
  if (repris.chargement || dispo.chargement) {
    contenu = <Chargement />;
  } else if (paiementAffiche) {
    contenu = (
      <SuiviPaiement key={paiementAffiche.id} paiement={paiementAffiche} commandeId={commande.id}
        onRecommencer={() => {
          // « Recommencer » ouvre un formulaire neuf : l'ancien paiement (final) n'est plus affiché.
          setEcarte(paiementAffiche.id);
          setSuivi(null);
        }} />
    );
  } else if (!peutPayer(commande)) {
    contenu = (
      <EtatVide titre={t('paiements.page.nonDisponible.titre')}>
        {commande.statut_paiement === 'paye' ? t('paiements.page.nonDisponible.paye') : t('paiements.page.nonDisponible.contrat')}
      </EtatVide>
    );
  } else if (!dispo.configure) {
    contenu = (
      <EtatVide titre={t('paiements.page.bientot.titre')}>{t('paiements.page.bientot.texte')}</EtatVide>
    );
  } else {
    contenu = (
      <>
        {repris.introuvable && <p className={styles.alerte} role="alert">{t('paiements.page.introuvable')}</p>}
        <section aria-labelledby="titre-recap" className={styles.bloc}>
          <h2 id="titre-recap">{t('paiements.page.recap')}</h2>
          <dl className={styles.chiffres}>
            <div><dt>{t('paiements.bloc.convenu')}</dt><dd>{fcfa(commande.montant_convenu)}</dd></div>
            <div><dt>{t('paiements.bloc.paye')}</dt><dd>{fcfa(commande.montant_paye ?? 0)}</dd></div>
            <div><dt>{t('paiements.bloc.reste')}</dt><dd>{fcfa(reste)}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="titre-form-paiement" className={styles.bloc}>
          <h2 id="titre-form-paiement">{t('paiements.page.choisir')}</h2>
          <FormulairePaiement commande={commande} reste={reste} telephoneInitial={utilisateur?.telephone || ''}
            surCree={apresCreation} surEnCours={repris.relire} />
        </section>
      </>
    );
  }

  return (
    <div className={`conteneur section ${styles.page}`}>
      {retour}
      <h1 className="titre-page">{t('paiements.page.h1', { reference: commande.reference })}</h1>
      {contenu}
    </div>
  );
}
