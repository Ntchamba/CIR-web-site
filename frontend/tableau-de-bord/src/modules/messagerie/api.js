// BF-11 : messagerie côté équipe (/api/admin/messagerie/), voir docs/taches/vague-3-contrat-api.md.
import { api, ErreurApi } from '@/app/api.js';

const BASE = '/api/admin/messagerie/';

export const MAX_TEXTE = 2000;
export const MAX_FICHIERS = 3;
export const MAX_OCTETS = 10 * 1024 * 1024;
/** Types acceptés (le serveur contrôle la signature du fichier ; ce contrôle évite seulement un envoi inutile). */
export const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const ACCEPT = TYPES_ACCEPTES.join(',');

/** → { count, next, previous, results: [{ id, client: { id, nom_complet, email, telephone, langue },
 *  dernier_message: { texte, auteur_role, cree_le } | null, non_lus, dernier_message_le }] } */
export function listerConversations({ nonLus = '', recherche = '', page = 1 } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (nonLus === '1') params.set('non_lus', '1');
  if (recherche.trim()) params.set('search', recherche.trim());
  if (page > 1) params.set('page', String(page));
  const texte = params.toString();
  return api.get(texte ? `${BASE}conversations/?${texte}` : `${BASE}conversations/`, { signal });
}

/** `{ client: id }` → conversation (créée ou existante). */
export const ouvrirConversation = (client) => api.post(`${BASE}conversations/`, { client });

/** → { results: [<Message>], a_plus } du plus ancien au plus récent. `avant` : historique ; `apres` : rattrapage. */
export function listerMessages(conversation, { avant, apres, taille } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (avant) params.set('avant', String(avant));
  if (apres) params.set('apres', String(apres));
  if (taille) params.set('taille', String(taille));
  const texte = params.toString();
  return api.get(`${BASE}conversations/${conversation}/messages/${texte ? `?${texte}` : ''}`, { signal });
}

/** Texte seul (ou texte + commande) en JSON. → <Message> (201) */
export const envoyerTexte = (conversation, { texte, commande, cle_client: cleClient }) =>
  api.post(`${BASE}conversations/${conversation}/messages/`, {
    texte, ...(commande ? { commande } : {}), ...(cleClient ? { cle_client: cleClient } : {}),
  });

/** Avec pièces jointes : multipart { texte, commande?, cle_client?, fichiers[] }. → <Message> (201) */
export function envoyerAvecFichiers(conversation, { texte, commande, cle_client: cleClient, fichiers }) {
  const formulaire = new FormData();
  if (texte) formulaire.append('texte', texte);
  if (commande) formulaire.append('commande', String(commande));
  if (cleClient) formulaire.append('cle_client', cleClient);
  fichiers.forEach((fichier) => formulaire.append('fichiers', fichier, fichier.name));
  return api.envoyerFichiers(`${BASE}conversations/${conversation}/messages/`, formulaire);
}

/** Messages du client lus jusqu'à cet identifiant. → { non_lus } */
export const marquerLu = (conversation, jusquA) => api.post(`${BASE}conversations/${conversation}/lu/`, { jusqu_a: jusquA });

/** → { non_lus_total, conversations_non_lues } */
export const resumeMessagerie = ({ signal } = {}) => api.get(`${BASE}resume/`, { signal });

/**
 * Commandes d'un client, pour « à propos de… » (route des commandes, filtre `client`).
 * → liste de { id, reference }.
 */
export async function commandesDuClient(clientId, { signal } = {}) {
  const r = await api.get(`/api/admin/commandes/?client=${encodeURIComponent(clientId)}`, { signal });
  return (Array.isArray(r) ? r : r?.results || []).map((c) => ({ id: c.id, reference: c.reference }));
}

/**
 * Télécharge une pièce jointe privée avec le jeton de la session (un lien direct ne pourrait pas l'envoyer).
 * Seules les adresses de l'API sont acceptées : le jeton ne part jamais ailleurs. → Blob
 */
export async function lirePieceJointe(url) {
  const chemin = String(url || '');
  const adresse = chemin.startsWith('/') && !chemin.startsWith('//') ? api.baseUrl + chemin : chemin;
  if (!api.baseUrl || !adresse.startsWith(`${api.baseUrl}/`)) throw new ErreurApi(404);
  const jetons = api.jetons.lire();
  let reponse;
  try {
    reponse = await fetch(adresse, { headers: jetons?.acces ? { Authorization: `Bearer ${jetons.acces}` } : {} });
  } catch {
    throw new ErreurApi(0);
  }
  if (!reponse.ok) throw new ErreurApi(reponse.status);
  return reponse.blob();
}
