// BF-17 : équipe du CIR. Liste des membres, ajout, désactivation et réactivation (super-administrateur).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import FormulaireMembre from './composants/FormulaireMembre.jsx';
import LigneMembre from './composants/LigneMembre.jsx';
import useEquipe from './useEquipe.js';
import styles from './Equipe.module.css';

export default function EquipePage() {
  const { t } = useTraduction();
  usePageMeta(t('equipe.titre'));
  const { utilisateur, superAdmin } = useAuth();
  const { membres, chargement, erreur, recharger, ajouter, desactiver, reactiver } = useEquipe();
  const [formulaire, setFormulaire] = useState(false);
  const [erreurAction, setErreurAction] = useState(null);
  const [annonce, setAnnonce] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <div>
          <h1 className="titre-page">{t('equipe.titre')}</h1>
          <p className="sous-titre-page">{t('equipe.sousTitre')}</p>
        </div>
        {superAdmin && !formulaire && (
          <Bouton onClick={() => { setFormulaire(true); setAnnonce(''); }}>{t('equipe.ajouter')}</Bouton>
        )}
      </div>

      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={styles.succes}>{annonce}</p>}

      {superAdmin && formulaire && (
        <FormulaireMembre ajouter={ajouter} annuler={() => setFormulaire(false)}
          surAjout={(m) => { setFormulaire(false); setAnnonce(t('equipe.ajoute', { nom: m.nom_complet })); }} />
      )}

      <MessageErreur erreur={erreurAction} />

      {chargement ? (
        <Chargement texte={t('equipe.chargement')} />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : membres.length === 0 ? (
        <EtatVide titre={t('equipe.vide')}>{t('equipe.videTexte')}</EtatVide>
      ) : (
        <div className={`carte ${styles.tableau}`}>
          <table>
            <caption className="visuellement-cache">{t('equipe.legende')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('equipe.colonnes.membre')}</th>
                <th scope="col">{t('equipe.colonnes.telephone')}</th>
                <th scope="col">{t('equipe.colonnes.role')}</th>
                <th scope="col">{t('equipe.colonnes.statut')}</th>
                <th scope="col">{t('equipe.colonnes.derniereConnexion')}</th>
                {superAdmin && <th scope="col"><span className="visuellement-cache">{t('equipe.colonnes.actions')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <LigneMembre key={m.id} membre={m} peutGerer={superAdmin} estMoi={m.id === utilisateur?.id}
                  desactiver={desactiver} reactiver={reactiver} surErreur={setErreurAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
