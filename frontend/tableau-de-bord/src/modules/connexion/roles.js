// Rôles des comptes (miroir de backend/apps/comptes/roles.py).
export const ROLES = { CLIENT: 'client', MEMBRE: 'membre', SUPER_ADMIN: 'super_admin' };

export const LIBELLES_ROLES = {
  [ROLES.CLIENT]: 'Client',
  [ROLES.MEMBRE]: "Membre de l'équipe",
  [ROLES.SUPER_ADMIN]: 'Super-administrateur',
};

/** Rôles proposés à l'ajout d'un membre : [[valeur, libellé]] (format des options de <Champ>). */
export const OPTIONS_ROLES_EQUIPE = [
  [ROLES.MEMBRE, LIBELLES_ROLES[ROLES.MEMBRE]],
  [ROLES.SUPER_ADMIN, LIBELLES_ROLES[ROLES.SUPER_ADMIN]],
];

export const libelleRole = (role) => LIBELLES_ROLES[role] ?? role ?? '';

/** Vrai pour un membre ou un super-administrateur (le serveur envoie aussi `est_equipe`). */
export function estEquipe(utilisateur) {
  if (!utilisateur) return false;
  if (typeof utilisateur.est_equipe === 'boolean') return utilisateur.est_equipe;
  return utilisateur.role === ROLES.MEMBRE || utilisateur.role === ROLES.SUPER_ADMIN;
}

export const estSuperAdmin = (utilisateur) => utilisateur?.role === ROLES.SUPER_ADMIN;
