// BF-08 : connexion du client, puis retour à la page demandée (?suite=…).
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

import { useAuth } from './AuthContext.jsx';
import { cheminDeSuite } from './suite.js';
import { validerConnexion } from './validation.js';
import styles from './Compte.module.css';

export default function ConnexionPage() {
  const { t } = useTraduction();
  usePageMeta(t('compte.connexion.titre'), t('compte.connexion.description'));
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
        <h1 className="titre-page">{t('compte.connexion.titre')}</h1>
        <p className={styles.intro}>{t('compte.connexion.intro')}</p>
        <form onSubmit={envoyer} className={styles.champs} noValidate>
          <Champ libelle={t('compte.champs.email')} name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="email" inputMode="email" required />
          <Champ libelle={t('compte.champs.motDePasse')} name="mot_de_passe" type="password" value={form.mot_de_passe} onChange={changer}
            erreur={erreurs.mot_de_passe} autoComplete="current-password" required />
          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi} taille="large">{t('compte.connexion.bouton')}</Bouton>
        </form>
        <p className={styles.bascule}>
          {t('compte.connexion.pasDeCompte')}{' '}
          <Link to={`/inscription${parametres.get('suite') ? `?suite=${encodeURIComponent(suite)}` : ''}`}>
            {t('compte.connexion.creer')}
          </Link>
        </p>
      </div>
    </div>
  );
}
