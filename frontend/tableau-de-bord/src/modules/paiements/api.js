// BF-10, BF-12 : paiements côté équipe (/api/admin/paiements/), voir docs/taches/vague-4-contrat-api.md.
// Le numéro de téléphone du client n'arrive que masqué (`telephone_masque`) : on n'affiche rien d'autre.
import { api } from '@/app/api.js';

const BASE = '/api/admin/paiements/';

export const ETATS = ['en_attente', 'reussi', 'echoue', 'expire', 'annule', 'anomalie'];
export const MODES = ['mobile', 'lien', 'manuel'];
export const MODES_MANUELS = ['especes', 'virement', 'cheque', 'autre'];
/** États pour lesquels l'équipe peut relancer la vérification auprès de CamPay. */
export const ETATS_REVERIFIABLES = ['en_attente', 'expire', 'anomalie'];

/** Requête de la liste : `etat`, `mode`, `commande`, `recherche` (référence, client, commande), `page`. */
export function requetePaiements({ etat = '', mode = '', commande = '', recherche = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (etat) params.set('etat', etat);
  if (mode) params.set('mode', mode);
  if (commande) params.set('commande', String(commande));
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return texte ? `${BASE}?${texte}` : BASE;
}

/** → { count, next, previous, results: [{ id, reference, commande: { id, reference }, client: { id, nom_complet }, montant, devise,
 *  mode, etat, etat_libelle, operateur, telephone_masque, raison, raison_libelle, reference_campay, reference_operateur,
 *  saisi_par, mode_manuel, note, derniere_verification_le, cree_le, termine_le }] } */
export const listerPaiements = (criteres, { signal } = {}) => api.get(requetePaiements(criteres), { signal });

/** → { en_attente, anomalies, encaisse_mois } (`encaisse_mois` : null pour un membre simple). */
export const resumePaiements = ({ signal } = {}) => api.get(`${BASE}resume/`, { signal });

/** Relance la vérification auprès de CamPay (en_attente, expire, anomalie) → paiement mis à jour. */
export const reverifierPaiement = (id) => api.post(`${BASE}${encodeURIComponent(id)}/reverifier/`, {});

/** Règlement hors ligne : `{ montant, mode_manuel, note? }` → paiement créé (201), déjà « réussi ». */
export const enregistrerReglement = (commandeId, donnees) =>
  api.post(`${BASE}commandes/${encodeURIComponent(commandeId)}/reglements/`, donnees);
