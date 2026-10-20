// BF-11 : messagerie du client connecté (/api/messagerie/). Une conversation par client, créée à la demande.
// Le texte des messages est celui que les personnes ont écrit : il n'est jamais traduit ni interprété comme du HTML.
import { ErreurApi } from '@partage/api/client.js';
import { langueApi } from '@partage/i18n/i18n.js';

import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/** → {id, non_lus, dernier_message} */
export const conversation = ({ signal } = {}) => api.get('/api/messagerie/conversation/', { signal });

/**
 * `?avant=<id>` (historique), `?apres=<id>` (rattrapage), `?taille=30` →
 * {results: [<Message>] du plus ancien au plus récent, a_plus}.
 */
export const messages = (criteres = {}, { signal } = {}) => api.get(`/api/messagerie/messages/${requete(criteres)}`, { signal });

/** {texte?, commande?, cle_client?} → 201 <Message>. 429 `trop_de_messages`. */
export const envoyer = (corps) => api.post('/api/messagerie/messages/', corps);

/** Multipart {texte?, commande?, cle_client?, fichiers: [fichier ≤ 3]} → 201 <Message>. */
export const envoyerAvecFichiers = (formulaire) => api.envoyerFichiers('/api/messagerie/messages/', formulaire);

/** Marque lus les messages de l'équipe jusqu'à cet identifiant → {non_lus}. */
export const marquerLu = (jusquA) => api.post('/api/messagerie/lu/', { jusqu_a: jusquA });

/** → {non_lus} */
export const nonLus = ({ signal } = {}) => api.get('/api/messagerie/non-lus/', { signal });

/**
 * Pièce jointe privée (jamais dans /media/) : le téléchargement demande le jeton de connexion, un simple lien ne
 * suffit donc pas. Le jeton n'est envoyé qu'au serveur de l'API. Renvoie le contenu (Blob).
 */
export async function recupererFichier(url) {
  const absolue = /^https?:\/\//.test(url);
  if (absolue && !url.startsWith(`${api.baseUrl}/`)) throw new ErreurApi(403);
  const adresse = absolue ? url : api.baseUrl + url;
  const demander = () => fetch(adresse, {
    headers: { Authorization: `Bearer ${api.jetons.lire()?.acces ?? ''}`, 'Accept-Language': langueApi() },
  });
  let reponse;
  try {
    reponse = await demander();
    if (reponse.status === 401 && await api.rafraichir()) reponse = await demander();
  } catch {
    throw new ErreurApi(0);
  }
  if (!reponse.ok) throw new ErreurApi(reponse.status);
  return reponse.blob();
}
