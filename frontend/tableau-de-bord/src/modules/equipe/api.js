// BF-17 : membres de l'équipe (/api/admin/comptes/equipe/), réservé au super-administrateur côté serveur.
import { api, resultats } from '@/app/api.js';

const BASE = '/api/admin/comptes/equipe/';

/** Liste des membres (jusqu'à 100, l'équipe reste petite). Renvoie un tableau. */
export async function listerMembres({ signal } = {}) {
  const donnees = await api.get(`${BASE}?taille=100`, { signal });
  return resultats(donnees);
}

/** { email, nom_complet, telephone, role, mot_de_passe } → membre créé. */
export const ajouterMembre = (donnees) => api.post(BASE, donnees);

/** Retire l'accès au tableau de bord (le compte est conservé). → membre mis à jour. */
export const desactiverMembre = (id) => api.post(`${BASE}${id}/desactiver/`, {});

/** Rend l'accès au tableau de bord. → membre mis à jour. */
export const reactiverMembre = (id) => api.post(`${BASE}${id}/reactiver/`, {});
