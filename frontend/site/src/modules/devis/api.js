// BF-11, BF-12 : devis envoyés au client et demandes de rendu (/api/devis/). Lecture seule pour les devis :
// le client répond par la négociation de la commande. Le calcul des montants est fait par le serveur.
import { api } from '@/app/api.js';
import { requete } from '@/modules/catalogue/api.js';

/**
 * Devis envoyé : DevisResume {id, reference, commande, commande_reference, etat, expire, total, valide_jusqu_au, envoye_le}
 * + {lignes: [{ordre, type_ligne, libelle, surface_m2, dosage_kg_m2, quantite_kg, prix_kg, prix_m2, montant}], notes}.
 */
export const devis = (id, { signal } = {}) => api.get(`/api/devis/${id}/`, { signal });

/** Paginé : demandes de rendu du client (`reponse_equipe`, `devis`, `images`, `etat`). */
export const demandes = (criteres = {}, { signal } = {}) => api.get(`/api/devis/demandes-rendu/${requete(criteres)}`, { signal });

/** multipart : description, type_batiment, surface_m2?, produit?, commande?, images (5 au plus) → 201 DemandeRendu. */
export const creerDemande = (formulaire) => api.envoyerFichiers('/api/devis/demandes-rendu/', formulaire);
