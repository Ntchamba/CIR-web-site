// Données de test des commandes (formes du contrat d'API de la vague 2), partagées par les tests du site.
export const PROPOSITION_EQUIPE = {
  id: 11, auteur_role: 'equipe', auteur_nom: 'Équipe CIR', prix_m2: '12000', total: '510000', delai_jours: 10,
  message: 'Pose comprise, produits Jiuye', etat: 'en_attente', devis: null, peut_repondre: true,
  cree_le: '2026-10-16T09:00:00Z', repondu_le: null,
};

export const COMMANDE = {
  id: 7,
  reference: 'CIR-2026-0007',
  type_batiment: 'maison',
  etat: 'negociation',
  surface_m2: '42.50',
  description: 'Garage double, sol à refaire',
  adresse: { ville: 'Douala', quartier: 'Bonapriso', rue_ou_repere: 'Près de la pharmacie' },
  lignes: [{
    id: 1,
    produit: { id: 3, slug: 'yd-306', reference: 'YD-306', nom: 'Sable coloré', image: null },
    design: { id: 2, nom: 'Gris anthracite', couleur: '#444444' },
  }],
  montant_convenu: null, prix_m2_convenu: null, delai_convenu_jours: null, signe_le: null,
  montant_paye: 0, reste_a_payer: null, statut_paiement: 'non_applicable',
  propositions: [PROPOSITION_EQUIPE],
  historique: [
    { de: null, vers: 'nouvelle', par: 'client', cree_le: '2026-10-15T08:00:00Z' },
    { de: 'nouvelle', vers: 'negociation', par: 'equipe', cree_le: '2026-10-16T09:00:00Z' },
  ],
  contrat: null,
  devis: [],
  action_requise: true,
  actions_possibles: ['annuler', 'proposer'],
  cree_le: '2026-10-15T08:00:00Z',
  modifie_le: '2026-10-16T09:00:00Z',
};

export const COMMANDE_SIGNEE = {
  ...COMMANDE,
  etat: 'contrat_signe',
  montant_convenu: '510000', prix_m2_convenu: '12000', delai_convenu_jours: 10, signe_le: '2026-10-17T10:00:00Z',
  montant_paye: 0, reste_a_payer: 510000, statut_paiement: 'non_paye',
  propositions: [{ ...PROPOSITION_EQUIPE, etat: 'acceptee', peut_repondre: false, repondu_le: '2026-10-17T10:00:00Z' }],
  historique: [
    ...COMMANDE.historique,
    { de: 'negociation', vers: 'contrat_signe', par: 'client', cree_le: '2026-10-17T10:00:00Z' },
  ],
  contrat: {
    reference: 'CTR-2026-0007', signe_le: '2026-10-17T10:00:00Z', accepte_par: 'client',
    client: { nom_complet: 'Awa Ngono', email: 'awa@exemple.cm', telephone: '+237699000000' },
    adresse: 'Près de la pharmacie, Bonapriso, Douala',
    lignes: [{ produit_nom: 'Sable coloré', produit_reference: 'YD-306', design_nom: 'Gris anthracite' }],
    montant: '510000', prix_m2: '12000', delai_jours: 10, proposition: 11,
  },
  action_requise: false,
  actions_possibles: [],
};

export const RESUME_COMMANDE = {
  id: 7, reference: 'CIR-2026-0007', type_batiment: 'maison', etat: 'negociation', surface_m2: '42.50', nombre_lignes: 1,
  montant_convenu: null, montant_paye: 0, reste_a_payer: null, statut_paiement: 'non_applicable',
  action_requise: true, modifie_le: '2026-10-16T09:00:00Z', cree_le: '2026-10-15T08:00:00Z',
};

/** Paiement du client (contrat d'API de la vague 4) : numéro toujours masqué, aucune référence CamPay. */
export const PAIEMENT = {
  id: 5, reference: 'PAY-2026-0001', commande: { id: 7, reference: 'CIR-2026-0007' }, montant: 510000, devise: 'XAF',
  mode: 'mobile', etat: 'en_attente', etat_libelle: 'En attente', operateur: '', telephone_masque: '+237 6** ** ** 22',
  code_ussd: '', lien: '', raison: '', raison_libelle: '', cree_le: new Date().toISOString(), termine_le: null, peut_annuler: false,
};
