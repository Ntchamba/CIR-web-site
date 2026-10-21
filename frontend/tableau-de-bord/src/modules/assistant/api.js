// O1, O4 : assistant IA côté équipe (/api/admin/assistant/), voir docs/taches/vague-5-contrat-api.md.
// L'assistant ne fait que proposer : rien n'est envoyé ni publié automatiquement.
import { api } from '@/app/api.js';

const BASE = '/api/admin/assistant/';

export const TYPES_BROUILLON = ['reponse_contact', 'reponse_message', 'traduction'];
export const ETATS_BROUILLON = ['propose', 'accepte', 'modifie', 'rejete'];
export const AGENTS = ['conseiller', 'fond'];
export const RESULTATS = ['ok', 'bloque', 'erreur_temporaire', 'erreur', 'limite', 'consultation'];

function adresse(chemin, parametres) {
  const params = new URLSearchParams();
  Object.entries(parametres).forEach(([cle, valeur]) => {
    if (valeur !== '' && valeur != null && !(cle === 'page' && Number(valeur) <= 1)) params.set(cle, String(valeur));
  });
  const texte = params.toString();
  return texte ? `${BASE}${chemin}?${texte}` : `${BASE}${chemin}`;
}

/** → { configure, modele_assistant, modele_fond, limite_jour, messages_aujourdhui, messages_mois, jetons_mois } */
export const statutAssistant = ({ signal } = {}) => api.get(`${BASE}statut/`, { signal });

/** Requête de la liste des brouillons : `type`, `etat`, `page`. */
export const requeteBrouillons = ({ type = '', etat = '', page = 1 } = {}) => adresse('brouillons/', { type, etat, page });
/** → { count, next, previous, results: [<Brouillon>] } */
export const listerBrouillons = (criteres, { signal } = {}) => api.get(requeteBrouillons(criteres), { signal });

/**
 * Demande un brouillon (appel synchrone, jusqu'à 45 s) ; rien n'est envoyé ni publié.
 * `{ type: 'reponse_contact' | 'reponse_message', cible_id }` ou `{ type: 'traduction', texte, langues?, contexte? }`.
 * → <Brouillon> (201) : { id, type, cible_type, cible_id, langue, contenu (texte ou { langue: texte }), etat, bloque,
 *   cree_par: { id, nom_complet }, traite_par, cree_le, traite_le }
 */
export const creerBrouillon = (donnees, { signal } = {}) => api.post(`${BASE}brouillons/`, donnees, { signal });

/** `{ etat: 'accepte' | 'modifie' | 'rejete', contenu? }` : n'applique rien au contenu réel. */
export const traiterBrouillon = (id, donnees) => api.patch(`${BASE}brouillons/${encodeURIComponent(id)}/`, donnees);

/** Journal des appels à Gemini (sans texte) : `agent`, `resultat`, `page`. */
export const listerJournal = (criteres, { signal } = {}) => api.get(
  adresse('journal/', { agent: criteres?.agent, resultat: criteres?.resultat, page: criteres?.page }), { signal });
/** → comptes par résultat sur 30 jours */
export const resumeJournal = ({ signal } = {}) => api.get(`${BASE}journal/resume/`, { signal });

/** Super-administrateur seulement ; chaque consultation est journalisée par le serveur. */
export const listerConversations = (criteres, { signal } = {}) => api.get(adresse('conversations/', { page: criteres?.page }), { signal });
export const obtenirConversation = (cle, { signal } = {}) => api.get(`${BASE}conversations/${encodeURIComponent(cle)}/`, { signal });

// Le statut sert à plusieurs endroits (bouton de brouillon de chaque écran) : une seule demande par minute.
const DUREE_CACHE = 60_000;
let cache = null;

/** Statut, gardé une minute (`forcer` pour le recharger). Une erreur n'est pas gardée. */
export function statutAssistantEnCache({ forcer = false } = {}) {
  if (!forcer && cache && Date.now() - cache.le < DUREE_CACHE) return cache.promesse;
  const promesse = statutAssistant().catch((e) => {
    if (cache?.promesse === promesse) cache = null;
    throw e;
  });
  cache = { le: Date.now(), promesse };
  return promesse;
}

export function reinitialiserStatutAssistant() {
  cache = null;
}
