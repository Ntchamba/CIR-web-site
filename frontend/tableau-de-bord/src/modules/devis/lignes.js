// Lignes d'un devis dans l'éditeur : état de saisie (texte), corps envoyé au serveur, prix du catalogue, erreurs par ligne.
// Aucune formule de calcul ici : quantités et montants viennent du serveur (`POST calculer/`).
import { localeIntl } from '@/i18n/index.js';

export const TYPES_LIGNE = ['materiau', 'surface', 'forfait'];

/** Champs saisis, par type de ligne (en plus du libellé et du produit). */
export const CHAMPS_PAR_TYPE = {
  materiau: ['surface_m2', 'dosage_kg_m2', 'prix_kg'],
  surface: ['surface_m2', 'prix_m2'],
  forfait: ['montant_forfait'],
};

let compteur = 0;
const nouvelleCle = () => `ligne-${++compteur}`;

export const ligneVide = (type = 'materiau', extra = {}) => ({
  cle: nouvelleCle(), type_ligne: type, libelle: '', produit: '',
  surface_m2: '', dosage_kg_m2: '', prix_kg: '', prix_m2: '', montant_forfait: '', ...extra,
});

/** Ligne du serveur → saisie (nombres en texte). */
export function versSaisie(ligne) {
  const texte = (v) => (v == null ? '' : String(v));
  return ligneVide(ligne.type_ligne, {
    libelle: ligne.libelle || '',
    produit: ligne.produit != null ? String(ligne.produit?.id ?? ligne.produit) : '',
    surface_m2: texte(ligne.surface_m2), dosage_kg_m2: texte(ligne.dosage_kg_m2), prix_kg: texte(ligne.prix_kg),
    prix_m2: texte(ligne.prix_m2), montant_forfait: texte(ligne.montant_forfait),
  });
}

const nettoyer = (valeur) => String(valeur ?? '').replace(/[\s  ]/g, '').replace(',', '.');

/** Saisie → ligne envoyée : seuls les champs du type, les champs vides sont omis (le serveur dit ce qui manque). */
export function versCorps(ligne) {
  const corps = { type_ligne: ligne.type_ligne };
  if (ligne.libelle.trim()) corps.libelle = ligne.libelle.trim();
  if (ligne.produit) corps.produit = Number(ligne.produit);
  CHAMPS_PAR_TYPE[ligne.type_ligne].forEach((champ) => {
    const valeur = nettoyer(ligne[champ]);
    if (valeur !== '') corps[champ] = valeur;
  });
  return corps;
}

/**
 * Prix du catalogue pour ce produit et ce type de ligne : { champ, valeur } ou null s'il n'existe pas
 * (jamais de prix inventé). Le prix au kg ne sert qu'aux lignes de matériau, le prix au m² aux lignes à la surface.
 */
export function prixCatalogue(produit, type) {
  if (!produit || produit.prix == null || produit.prix === '') return null;
  if (type === 'materiau' && produit.unite_prix === 'kg') return { champ: 'prix_kg', valeur: String(produit.prix) };
  if (type === 'surface' && ['m2', 'pose'].includes(produit.unite_prix)) return { champ: 'prix_m2', valeur: String(produit.prix) };
  return null;
}

/** Applique le prix du catalogue à la ligne, sauf si une valeur est déjà saisie dans ce champ. */
export function avecPrixCatalogue(ligne, produit) {
  const prix = prixCatalogue(produit, ligne.type_ligne);
  if (!prix || ligne[prix.champ] !== '') return ligne;
  return { ...ligne, [prix.champ]: prix.valeur };
}

/** Erreurs 400 : { parLigne: [{ champ: message }], generale: 'message de la liste' } (listes imbriquées comprises). */
export function erreursLignes(erreur) {
  const brut = erreur?.donnees?.lignes;
  if (!brut) return { parLigne: [], generale: '' };
  if (Array.isArray(brut) && brut.some((e) => e && typeof e === 'object' && !Array.isArray(e))) {
    const parLigne = brut.map((e) => {
      const champs = {};
      Object.entries(e && typeof e === 'object' && !Array.isArray(e) ? e : {}).forEach(([champ, valeur]) => {
        const message = Array.isArray(valeur) ? valeur.find((m) => typeof m === 'string') : valeur;
        if (typeof message === 'string' && message) champs[champ] = message;
      });
      return champs;
    });
    return { parLigne, generale: '' };
  }
  const premier = Array.isArray(brut) ? brut.find((m) => typeof m === 'string') : (typeof brut === 'string' ? brut : '');
  return { parLigne: [], generale: premier || '' };
}

/** Erreurs de l'aperçu `[{ ligne, champ, message }]` → [{ champ: message }] par ligne (indice de la ligne envoyée). */
export function erreursApercu(erreurs = [], nombre = 0) {
  const parLigne = Array.from({ length: nombre }, () => ({}));
  erreurs.forEach(({ ligne, champ, message }) => {
    if (parLigne[ligne] && !parLigne[ligne][champ || 'ligne']) parLigne[ligne][champ || 'ligne'] = message;
  });
  return parLigne;
}

/** Quantité en kilos, dans la langue de l'interface. */
export function kilos(valeur) {
  if (valeur == null || valeur === '' || Number.isNaN(Number(valeur))) return '—';
  return `${new Intl.NumberFormat(localeIntl(), { maximumFractionDigits: 2 }).format(Number(valeur))} kg`;
}
