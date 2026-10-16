// Coordonnées publiques du CIR (numéros validés par le propriétaire le 14 octobre 2026).
// La ville affichée est traduite (clé marque.ville). Elles seront modifiables depuis le tableau de bord dans une vague suivante.
export const TELEPHONES = [
  { affichage: '+237 6 99 81 16 35', lien: 'tel:+237699811635' },
  { affichage: '+237 6 78 82 93 13', lien: 'tel:+237678829313' },
  { affichage: '+237 6 56 43 58 46', lien: 'tel:+237656435846' },
];

export const COORDONNEES = {
  telephone: TELEPHONES[0].affichage,
  lienTelephone: TELEPHONES[0].lien,
};
