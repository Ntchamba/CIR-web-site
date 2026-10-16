// Rôles des comptes (miroir de backend/apps/comptes/roles.py). Libellés traduits : clés roles.<rôle>.
import { existe, t } from '@/i18n/index.js';

export const ROLES = { CLIENT: 'client', MEMBRE: 'membre', SUPER_ADMIN: 'super_admin' };

/** Libellé d'un rôle dans la langue courante (le code tel quel s'il est inconnu). */
export const libelleRole = (role) => (role && existe(`roles.${role}`) ? t(`roles.${role}`) : role ?? '');

/** Rôles proposés à l'ajout d'un membre : [[valeur, libellé]] (format des options de <Champ>). */
export const optionsRolesEquipe = () => [ROLES.MEMBRE, ROLES.SUPER_ADMIN].map((r) => [r, libelleRole(r)]);

/** Vrai pour un membre ou un super-administrateur (le serveur envoie aussi `est_equipe`). */
export function estEquipe(utilisateur) {
  if (!utilisateur) return false;
  if (typeof utilisateur.est_equipe === 'boolean') return utilisateur.est_equipe;
  return utilisateur.role === ROLES.MEMBRE || utilisateur.role === ROLES.SUPER_ADMIN;
}

export const estSuperAdmin = (utilisateur) => utilisateur?.role === ROLES.SUPER_ADMIN;
