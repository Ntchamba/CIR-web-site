// En-tête : bouton du menu (téléphone), personne connectée et son rôle, choix de la langue, déconnexion.
import { useNavigate } from 'react-router';

import ChoixLangue from '@partage/ui/ChoixLangue.jsx';
import Icone from '@partage/ui/Icone.jsx';

import { useTraduction } from '@/i18n/index.js';
import { useAuth } from '@/modules/connexion/AuthContext.jsx';
import { libelleRole } from '@/modules/connexion/roles.js';

import CentreNotifications from '@/modules/notifications/composants/CentreNotifications.jsx';

import styles from './Coque.module.css';

export function initiales(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  return (mots.slice(0, 2).map((m) => m[0]).join('') || 'CIR').toUpperCase();
}

export default function Entete({ idMenu, menuOuvert, basculerMenu }) {
  const { t } = useTraduction();
  const { utilisateur, seDeconnecter, retenirLangue } = useAuth();
  const naviguer = useNavigate();

  async function deconnecter() {
    await seDeconnecter();
    naviguer('/connexion', { replace: true });
  }

  return (
    <header className={styles.entete}>
      <button type="button" className={styles.boutonMenu} onClick={basculerMenu}
        aria-expanded={menuOuvert} aria-controls={idMenu}
        aria-label={menuOuvert ? t('coque.fermerMenu') : t('coque.ouvrirMenu')}>
        <Icone nom={menuOuvert ? 'fermer' : 'menu'} taille={22} />
      </button>
      <div className={styles.moi}>
        <span className={styles.avatar} aria-hidden="true">{initiales(utilisateur?.nom_complet)}</span>
        <span className={styles.identite}>
          <strong>{utilisateur?.nom_complet || utilisateur?.email}</strong>
          <small>{libelleRole(utilisateur?.role)}</small>
        </span>
      </div>
      <CentreNotifications />
      <ChoixLangue className={styles.langue} surChangement={retenirLangue} />
      <button type="button" className={styles.sortie} onClick={deconnecter}>
        <Icone nom="sortie" taille={20} />
        <span>{t('coque.seDeconnecter')}</span>
      </button>
    </header>
  );
}
