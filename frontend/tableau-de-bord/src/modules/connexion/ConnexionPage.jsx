// BF-17 : connexion de l'équipe au tableau de bord (comptes clients refusés par le serveur).
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { erreursChamps } from '@partage/api/client.js';
import Bouton from '@partage/ui/Bouton.jsx';
import Champ from '@partage/ui/Champ.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import ChoixLangue from '@partage/ui/ChoixLangue.jsx';

import { useTraduction } from '@/i18n/index.js';

import { useAuth } from './AuthContext.jsx';
import { cheminDeSuite } from './suite.js';
import { validerConnexion } from './validation.js';
import styles from './Connexion.module.css';

export default function ConnexionPage() {
  const { t } = useTraduction();
  usePageMeta(t('connexion.meta'), t('connexion.description'));
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
      const champs = erreursChamps(err);
      setErreurs(champs);
      // Message général si l'erreur ne concerne aucun champ du formulaire (refus, réseau, serveur…).
      if (!Object.keys(champs).some((cle) => cle in form)) setErreur(err);
      setEnvoi(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.carte}>
        <div className={styles.marque}>
          <img src="/media/marque/logo-cir.webp" alt="" width="48" height="48" />
          <span><strong>CIR</strong> {t('connexion.marque')}</span>
        </div>
        <h1 className="titre-page">{t('connexion.titre')}</h1>
        <p className={styles.intro}>{t('connexion.intro')}</p>
        <form onSubmit={envoyer} className={styles.champs} noValidate>
          <Champ libelle={t('connexion.email')} name="email" type="email" value={form.email} onChange={changer}
            erreur={erreurs.email} autoComplete="username" inputMode="email" required />
          <Champ libelle={t('connexion.motDePasse')} name="mot_de_passe" type="password" value={form.mot_de_passe}
            onChange={changer} erreur={erreurs.mot_de_passe} autoComplete="current-password" required />
          <MessageErreur erreur={erreur} />
          <Bouton type="submit" chargement={envoi} taille="large">{t('connexion.bouton')}</Bouton>
        </form>
        <ChoixLangue className={styles.langue} />
      </div>
    </main>
  );
}
