// Connexion de l'équipe. Après 5 essais incorrects, le back-end bloque l'accès 15 minutes.
// Le code de vérification par SMS est prévu avec le module de téléphonie (à venir).
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Icone from '@/components/ui/Icone.jsx';
import { Champ, Erreur } from '@/components/ui/elements.jsx';

import { useAuth } from './AuthContext.jsx';
import styles from './Connexion.module.css';

export default function ConnexionPage() {
  const { utilisateur, pret, seConnecter } = useAuth();
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { document.title = 'Connexion · CIR administration'; }, []);

  if (pret && utilisateur) return <Navigate to={parametres.get('suite') || '/'} replace />;

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await seConnecter(email, motDePasse);
      naviguer(parametres.get('suite') || '/', { replace: true });
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.visuel}>
        <img src="/media/marque/logo-cir.webp" alt="" width="48" height="48" />
        <div>
          <p className={styles.slogan}>Piloter la plateforme, en toute sécurité.</p>
          <p>Commandes, négociations, catalogue et contenus du site : tout se gère depuis cet espace réservé à l'équipe du CIR.</p>
        </div>
      </div>
      <div className={styles.cote}>
        <form className={styles.formulaire} onSubmit={envoyer}>
          <span className={styles.reserve}><Icone nom="compte" taille={15} />Accès réservé à l'équipe</span>
          <h1>Se connecter</h1>
          <Champ libelle="Adresse e-mail professionnelle" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <Champ libelle="Mot de passe" type="password" autoComplete="current-password" value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} required />
          <div className={styles.code}>
            <span>Code de vérification par SMS</span>
            <small>Bientôt disponible, avec le module de téléphonie.</small>
          </div>
          <Erreur erreur={erreur} />
          <button type="submit" className="bouton" disabled={envoi}>{envoi ? 'Connexion…' : 'Accéder au tableau de bord'}</button>
          <p className={styles.note}>Adresse non publiée sur le site. Après 5 essais incorrects, l'accès est bloqué 15 minutes.</p>
        </form>
      </div>
    </div>
  );
}
