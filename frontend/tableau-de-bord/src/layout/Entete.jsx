// En-tête : bouton du menu (téléphone), personne connectée et son rôle, déconnexion.
import { useNavigate } from 'react-router';

import Icone from '@partage/ui/Icone.jsx';

import { useAuth } from '@/modules/connexion/AuthContext.jsx';
import { libelleRole } from '@/modules/connexion/roles.js';

import styles from './Coque.module.css';

export function initiales(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  return (mots.slice(0, 2).map((m) => m[0]).join('') || 'CIR').toUpperCase();
}

export default function Entete({ idMenu, menuOuvert, basculerMenu }) {
  const { utilisateur, seDeconnecter } = useAuth();
  const naviguer = useNavigate();

  async function deconnecter() {
    await seDeconnecter();
    naviguer('/connexion', { replace: true });
  }

  return (
    <header className={styles.entete}>
      <button type="button" className={styles.boutonMenu} onClick={basculerMenu}
        aria-expanded={menuOuvert} aria-controls={idMenu}
        aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}>
        <Icone nom={menuOuvert ? 'fermer' : 'menu'} taille={22} />
      </button>
      <div className={styles.moi}>
        <span className={styles.avatar} aria-hidden="true">{initiales(utilisateur?.nom_complet)}</span>
        <span className={styles.identite}>
          <strong>{utilisateur?.nom_complet || utilisateur?.email}</strong>
          <small>{libelleRole(utilisateur?.role)}</small>
        </span>
      </div>
      <button type="button" className={styles.sortie} onClick={deconnecter}>
        <Icone nom="sortie" taille={20} />
        <span>Se déconnecter</span>
      </button>
    </header>
  );
}
