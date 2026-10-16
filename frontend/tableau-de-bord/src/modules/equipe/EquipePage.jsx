// BF-17 : équipe du CIR. Liste des membres, ajout, désactivation et réactivation (super-administrateur).
import { useState } from 'react';

import Bouton from '@partage/ui/Bouton.jsx';
import Chargement from '@partage/ui/Chargement.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import MessageErreur from '@partage/ui/MessageErreur.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useAuth } from '@/modules/connexion/AuthContext.jsx';

import FormulaireMembre from './composants/FormulaireMembre.jsx';
import LigneMembre from './composants/LigneMembre.jsx';
import useEquipe from './useEquipe.js';
import styles from './Equipe.module.css';

export default function EquipePage() {
  usePageMeta('Équipe');
  const { utilisateur, superAdmin } = useAuth();
  const { membres, chargement, erreur, recharger, ajouter, desactiver, reactiver } = useEquipe();
  const [formulaire, setFormulaire] = useState(false);
  const [erreurAction, setErreurAction] = useState(null);
  const [annonce, setAnnonce] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <div>
          <h1 className="titre-page">Équipe</h1>
          <p className="sous-titre-page">Les personnes qui ont accès au tableau de bord.</p>
        </div>
        {superAdmin && !formulaire && (
          <Bouton onClick={() => { setFormulaire(true); setAnnonce(''); }}>Ajouter un membre</Bouton>
        )}
      </div>

      <p className="visuellement-cache" role="status" aria-live="polite">{annonce}</p>
      {annonce && <p className={styles.succes}>{annonce}</p>}

      {superAdmin && formulaire && (
        <FormulaireMembre ajouter={ajouter} annuler={() => setFormulaire(false)}
          surAjout={(m) => { setFormulaire(false); setAnnonce(`${m.nom_complet} a été ajouté à l'équipe.`); }} />
      )}

      <MessageErreur erreur={erreurAction} />

      {chargement ? (
        <Chargement texte="Chargement de l'équipe…" />
      ) : erreur ? (
        <MessageErreur erreur={erreur} reessayer={recharger} />
      ) : membres.length === 0 ? (
        <EtatVide titre="Aucun membre pour l'instant">Ajoutez le premier membre de l'équipe.</EtatVide>
      ) : (
        <div className={`carte ${styles.tableau}`}>
          <table>
            <caption className="visuellement-cache">Membres de l'équipe</caption>
            <thead>
              <tr>
                <th scope="col">Membre</th>
                <th scope="col">Téléphone</th>
                <th scope="col">Rôle</th>
                <th scope="col">Statut</th>
                <th scope="col">Dernière connexion</th>
                {superAdmin && <th scope="col"><span className="visuellement-cache">Actions</span></th>}
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
