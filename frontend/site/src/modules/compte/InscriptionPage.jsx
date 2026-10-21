// BF-08, BF-17 : création du compte client, avec l'adresse complète (obligatoire pour commander).
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import { ADRESSE_VIDE } from './adresse.js';
import { useAuth } from './AuthContext.jsx';
import EcranCompte from './composants/EcranCompte.jsx';
import FormulaireAdresse from './FormulaireAdresse.jsx';
import { cheminDeSuite } from './suite.js';
import { validerInscription } from './validation.js';

const FORMULAIRE_VIDE = { nom_complet: '', email: '', telephone: '', mot_de_passe: '', confirmation: '', consentement: false, ...ADRESSE_VIDE };

export default function InscriptionPage() {
  const { t } = useTraduction();
  usePageMeta(t('compte.inscription.titre'), t('compte.inscription.description'));
  const { utilisateur, pret, sInscrire } = useAuth();
  const [parametres] = useSearchParams();
  const suite = cheminDeSuite(parametres);
  const naviguer = useNavigate();
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (pret && utilisateur && !envoi) return <Navigate to={suite} replace />;

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const changerAdresse = (adresse) => setForm((f) => ({ ...f, ...adresse }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerInscription(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) {
      setErreur(t('compte.inscription.incomplet'));
      return;
    }
    setEnvoi(true);
    // `confirmation` et `consentement` ne partent pas au serveur : ils ne servent qu'à la vérification dans le navigateur.
    const { confirmation, consentement, ...champs } = form; // eslint-disable-line no-unused-vars
    const donnees = Object.fromEntries(
      Object.entries(champs).map(([cle, valeur]) => [cle, cle === 'mot_de_passe' ? valeur : valeur.trim()]),
    );
    try {
      await sInscrire(donnees);
      naviguer(suite, { replace: true });
    } catch (err) {
      setErreurs(erreursChamps(err));
      setErreur(err);
      setEnvoi(false);
    }
  }

  const adresse = { ville: form.ville, quartier: form.quartier, rue_ou_repere: form.rue_ou_repere };

  return (
    <EcranCompte onglet="inscription" suite={parametres.get('suite') ? suite : ''}>
      <p className="visuellement-cache">{t('compte.inscription.intro')}</p>
      <form onSubmit={envoyer} className="m-champs" noValidate aria-label={t('compte.inscription.titre')}>
        <Champ libelle={t('compte.champs.nomComplet')} name="nom_complet" value={form.nom_complet} onChange={changer}
          erreur={erreurs.nom_complet} autoComplete="name" required />
        <div className="m-deux">
          <Champ libelle={t('compte.champs.telephone')} name="telephone" type="tel" value={form.telephone} onChange={changer}
            erreur={erreurs.telephone} autoComplete="tel" placeholder={t('compte.exemples.telephone')} />
          <Champ libelle={t('compte.champs.email')} name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="email" inputMode="email" required />
        </div>
        <fieldset className="m-adresse">
          <legend>{t('compte.inscription.adresse')}</legend>
          <FormulaireAdresse valeur={adresse} onChange={changerAdresse} erreurs={erreurs} />
        </fieldset>
        <div className="m-deux">
          <Champ libelle={t('compte.champs.motDePasse')} name="mot_de_passe" type="password" value={form.mot_de_passe}
            onChange={changer} erreur={erreurs.mot_de_passe} autoComplete="new-password" aide={t('compte.aides.motDePasse')} required />
          <Champ libelle={t('compte.champs.confirmation')} name="confirmation" type="password" value={form.confirmation}
            onChange={changer} erreur={erreurs.confirmation} autoComplete="new-password" required />
        </div>
        <div>
          <label className="m-case">
            <input type="checkbox" name="consentement" checked={form.consentement} onChange={(e) => setForm((f) => ({ ...f, consentement: e.target.checked }))}
              aria-invalid={erreurs.consentement ? true : undefined} />
            <span>{t('compte.inscription.consentement')}</span>
          </label>
          {erreurs.consentement && <span className="m-erreur-champ">{erreurs.consentement}</span>}
        </div>
        <MessageErreur erreur={erreur} />
        <button type="submit" className="m-btn plein m-btn-compte" disabled={envoi} aria-busy={envoi || undefined}>{t('compte.inscription.bouton')}</button>
      </form>
    </EcranCompte>
  );
}
