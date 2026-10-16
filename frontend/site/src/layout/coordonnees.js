// Coordonnées publiques du CIR, utilisées en secours tant que GET /api/contenus/accueil/ n'a pas répondu
// (ou s'il renvoie des champs vides). Numéros validés par le propriétaire le 14 octobre 2026 ; WhatsApp et
// adresse : catalogue du fabricant (cahier des charges, « Coordonnées figurant au catalogue »).
// La ville affichée est traduite (clé marque.ville) ; l'adresse est un nom propre, jamais traduit.

/** « +237 6 99 81 16 35 » → « tel:+237699811635 » */
export function lienTelephone(numero) {
  const chiffres = String(numero || '').replace(/[^\d+]/g, '');
  return chiffres ? `tel:${chiffres}` : '';
}

/** « +237 622 191 931 » → « https://wa.me/237622191931 » (message prérempli facultatif). */
export function lienWhatsApp(numero, message) {
  const chiffres = String(numero || '').replace(/\D/g, '');
  if (!chiffres) return '';
  return `https://wa.me/${chiffres}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export const TELEPHONES = [
  { affichage: '+237 6 99 81 16 35', lien: 'tel:+237699811635' },
  { affichage: '+237 6 78 82 93 13', lien: 'tel:+237678829313' },
  { affichage: '+237 6 56 43 58 46', lien: 'tel:+237656435846' },
];

export const WHATSAPP = '+237 622 191 931';
export const ADRESSE = 'Total Nkolmbong, Douala';

export const COORDONNEES = {
  telephone: TELEPHONES[0].affichage,
  lienTelephone: TELEPHONES[0].lien,
};

/**
 * Coordonnées à afficher : celles de l'API (`coordonnees` de /api/contenus/accueil/), champ par champ,
 * sinon celles de ce fichier.
 */
export function fusionnerCoordonnees(api) {
  const numeros = (api?.telephones || []).filter((n) => typeof n === 'string' && n.trim());
  const telephones = numeros.length
    ? numeros.map((n) => ({ affichage: n.trim(), lien: lienTelephone(n) }))
    : TELEPHONES;
  const whatsapp = api?.whatsapp?.trim() || WHATSAPP;
  return {
    telephones,
    telephone: telephones[0],
    whatsapp: { affichage: whatsapp, lien: lienWhatsApp(whatsapp) },
    email: api?.email?.trim() || '',
    adresse: api?.adresse?.trim() || ADRESSE,
  };
}
