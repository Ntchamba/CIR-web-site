// Appels à l'API pour l'accueil. Le contenu de l'accueil est chargé une seule fois et partagé
// (accueil, pied de page, boutons de contact).
import { api, resultats } from '@/lib/api.js';

let contenuEnCache = null;

export function chargerContenuAccueil() {
  contenuEnCache ??= api.get('/contenus/accueil/', { auth: false }).catch((e) => {
    contenuEnCache = null;
    throw e;
  });
  return contenuEnCache;
}

export const produitsALaUne = (signal) =>
  api.get('/catalogue/produits/?une=true&taille=8', { auth: false, signal }).then(resultats);

export const realisationsRecentes = (signal) =>
  api.get('/vitrine/realisations/?taille=4', { auth: false, signal }).then(resultats);

export const temoignages = (signal) =>
  api.get('/vitrine/temoignages/?taille=6', { auth: false, signal }).then(resultats);

/** Coordonnées par défaut, utilisées tant que l'API n'a pas répondu. */
export const COORDONNEES = {
  telephone: '+237 678 829 313',
  whatsapp: '+237 622 191 931',
  adresse: 'Douala, Cameroun',
};

export const lienWhatsApp = (numero, texte = '') =>
  `https://wa.me/${String(numero).replace(/\D/g, '')}${texte ? `?text=${encodeURIComponent(texte)}` : ''}`;
