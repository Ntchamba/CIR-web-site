// Écran de connexion / création de compte de la maquette : écran partagé. À gauche, une fenêtre sur la scène du salon
// avec le logo, « Votre sol, révélé. » et « ← Retour à l'accueil » ; à droite les deux onglets « Se connecter » /
// « Créer un compte » (liens vers /connexion et /inscription, la suite demandée est conservée) et le formulaire.
// Téléphone : bandeau de 210 px en haut (avec la flèche « < »), formulaire dessous.
import { Link } from 'react-router';

import { useTraduction } from '@/i18n/index.js';
import BoutonRetour from '@/layout/BoutonRetour.jsx';

export default function EcranCompte({ onglet, suite = '', children }) {
  const { t } = useTraduction();
  const requete = suite ? `?suite=${encodeURIComponent(suite)}` : '';
  return (
    <div className="m-compte">
      <div className="m-compte-visuel">
        <div className="fenetre" aria-hidden="true" />
        <div className="m-compte-haut">
          <BoutonRetour />
          <Link to="/" className="m-marque-claire" aria-label={t('entete.retourAccueil')}>
            <img src="/media/marque/logo-cir.webp" alt="" width="46" height="46" />
            <span><b>CIR</b><small>{t('marque.nom')}</small></span>
          </Link>
        </div>
        <div>
          <h1>{t('compte.visuel')}<i>.</i></h1>
          <p className="m-retour-lien"><Link to="/"><span aria-hidden="true">←</span> {t('introuvable.retour')}</Link></p>
        </div>
      </div>
      <div className="m-compte-formes">
        <div className="m-compte-boite">
          <Link to="/" className="m-retour-accueil-tel"><span aria-hidden="true">←</span>&nbsp;{t('introuvable.retour')}</Link>
          <div className="m-bascule" role="group" aria-label={t('compte.inscription.groupeOnglets')}>
            <Link to={`/connexion${requete}`} aria-current={onglet === 'connexion' ? 'page' : undefined}>{t('compte.connexion.titre')}</Link>
            <Link to={`/inscription${requete}`} aria-current={onglet === 'inscription' ? 'page' : undefined}>{t('compte.inscription.titre')}</Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
