// BF-08, BF-17 : création du compte client, avec l'adresse complète (obligatoire pour commander).
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { ADRESSE_VIDE } from './adresse.js';
import { useAuth } from './AuthContext.jsx';
import FormulaireAdresse from './FormulaireAdresse.jsx';
import { cheminDeSuite } from './suite.js';
import { validerInscription } from './validation.js';
import styles from './Compte.module.css';

const FORMULAIRE_VIDE = { nom_complet: '', email: '', telephone: '', mot_de_passe: '', ...ADRESSE_VIDE };

export default function InscriptionPage() {
  usePageMeta('Créer un compte', 'Créez votre compte CIR pour commander vos revêtements de sol en résine époxy.');
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
      setErreur('Certaines informations manquent ou sont incorrectes. Vérifiez le formulaire.');
      return;
    }
    setEnvoi(true);
    const donnees = Object.fromEntries(
      Object.entries(form).map(([cle, valeur]) => [cle, cle === 'mot_de_passe' ? valeur : valeur.trim()]),
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
    <div className={`conteneur section ${styles.page}`}>
      <div className={`${styles.carte} ${styles.carteLarge}`}>
        <h1 className="titre-page">Créer un compte</h1>
        <p className={styles.intro}>Votre compte permet de commander et de suivre vos travaux.</p>
        <form onSubmit={envoyer} className={styles.champs} noValidate>
          <fieldset className={styles.groupe}>
            <legend>Vos coordonnées</legend>
            <Champ libelle="Nom complet" name="nom_complet" value={form.nom_complet} onChange={changer}
              erreur={erreurs.nom_complet} autoComplete="name" required />
            <Champ libelle="E-mail" name="email" type="email" value={form.email} onChange={changer}
              erreur={erreurs.email} autoComplete="email" inputMode="email" required />
            <Champ libelle="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={changer}
              erreur={erreurs.telephone} autoComplete="tel" placeholder="+237 6XX XX XX XX"
              aide="Facultatif, mais utile pour que notre équipe vous rappelle." />
            <Champ libelle="Mot de passe" name="mot_de_passe" type="password" value={form.mot_de_passe}
              onChange={changer} erreur={erreurs.mot_de_passe} autoComplete="new-password"
              aide="8 caractères au moins, pas uniquement des chiffres." required />
          </fieldset>

          <fieldset className={styles.groupe}>
            <legend>Votre adresse</legend>
            <p className={styles.aide}>Elle est nécessaire pour commander et pour la venue de notre équipe.</p>
            <FormulaireAdresse valeur={adresse} onChange={changerAdresse} erreurs={erreurs} />
          </fieldset>

          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi} taille="large">Créer mon compte</Bouton>
        </form>
        <p className={styles.bascule}>
          Déjà un compte ?{' '}
          <Link to={`/connexion${parametres.get('suite') ? `?suite=${encodeURIComponent(suite)}` : ''}`}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
