// BF-08 : connexion du client, puis retour à la page demandée (?suite=…).
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useAuth } from './AuthContext.jsx';
import { cheminDeSuite } from './suite.js';
import { validerConnexion } from './validation.js';
import styles from './Compte.module.css';

export default function ConnexionPage() {
  usePageMeta('Se connecter', 'Connectez-vous à votre compte CIR pour commander et suivre vos travaux.');
  const { utilisateur, pret, seConnecter } = useAuth();
  const [parametres] = useSearchParams();
  const suite = cheminDeSuite(parametres);
  const naviguer = useNavigate();
  const [form, setForm] = useState({ email: '', mot_de_passe: '' });
  const [erreurs, setErreurs] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (pret && utilisateur && !envoi) return <Navigate to={suite} replace />;

  const changer = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function envoyer(e) {
    e.preventDefault();
    const locales = validerConnexion(form);
    setErreurs(locales);
    setErreur(null);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      await seConnecter(form.email.trim(), form.mot_de_passe);
      naviguer(suite, { replace: true });
    } catch (err) {
      setErreurs(erreursChamps(err));
      setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <div className={`conteneur section ${styles.page}`}>
      <div className={styles.carte}>
        <h1 className="titre-page">Se connecter</h1>
        <p className={styles.intro}>Accédez à vos commandes et au suivi de vos travaux.</p>
        <form onSubmit={envoyer} className={styles.champs} noValidate>
          <Champ libelle="E-mail" name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="email" inputMode="email" required />
          <Champ libelle="Mot de passe" name="mot_de_passe" type="password" value={form.mot_de_passe} onChange={changer}
            erreur={erreurs.mot_de_passe} autoComplete="current-password" required />
          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi} taille="large">Se connecter</Bouton>
        </form>
        <p className={styles.bascule}>
          Pas encore de compte ?{' '}
          <Link to={`/inscription${parametres.get('suite') ? `?suite=${encodeURIComponent(suite)}` : ''}`}>
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
