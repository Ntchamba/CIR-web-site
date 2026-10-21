// O1, O4 : assistant IA (/api/assistant/). Accès libre ; si le client est connecté, son jeton est envoyé et il est reconnu.
// Le texte d'une réponse est TOUJOURS affiché comme texte brut ; seuls les `liens` du serveur sont cliquables.
import { api } from '@/app/api.js';

/** → {configure: bool, ouvert: bool} (jamais de nombre exact). */
export const disponibilite = ({ signal } = {}) => api.get('/api/assistant/disponibilite/', { signal });

/**
 * {cle?, texte, langue?, contexte?: {type: 'produit'|'commande'|'page', reference?}} →
 * {cle, message: {id, role, texte, liens: [{libelle, chemin}], bloque, cree_le}, proposer_contact, restant}.
 * Erreurs : 429 `assistant_trop_de_messages`, 503 `assistant_limite_atteinte` | `assistant_non_configure` | `assistant_indisponible`.
 */
export const envoyer = (corps) => api.post('/api/assistant/messages/', corps);

/** → {cle, messages: [<message>]} (404 : clé inconnue ou d'un autre compte). */
export const conversation = (cle, { signal } = {}) => api.get(`/api/assistant/conversations/${encodeURIComponent(cle)}/`, { signal });

/** → 204 : supprime la conversation et ses messages. */
export const effacer = (cle) => api.supprimer(`/api/assistant/conversations/${encodeURIComponent(cle)}/`);

/** {utile: bool} → 204 (une seule fois par message). */
export const donnerAvis = (id, utile) => api.post(`/api/assistant/messages/${encodeURIComponent(id)}/avis/`, { utile });
