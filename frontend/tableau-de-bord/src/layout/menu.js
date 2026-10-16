// Entrées du menu latéral. Les modules des vagues suivantes sont listés « Bientôt disponible » :
// leur page affiche un simple message en attendant (voir routes.jsx).

/** Modules livrés. `superAdmin` : entrée visible seulement pour le super-administrateur. */
export const MODULES_ACTIFS = [
  { chemin: '/', libelle: 'Accueil', icone: 'accueil', fin: true },
  { chemin: '/clients', libelle: 'Clients', icone: 'clients' },
  { chemin: '/equipe', libelle: 'Équipe', icone: 'equipe', superAdmin: true },
];

export const MODULES_A_VENIR = [
  { chemin: '/commandes', libelle: 'Commandes', icone: 'commandes', texte: 'Le suivi des commandes et des négociations arrive bientôt.' },
  { chemin: '/devis', libelle: 'Devis', icone: 'devis', texte: 'Les demandes de devis arrivent bientôt.' },
  { chemin: '/messagerie', libelle: 'Messagerie', icone: 'message', texte: 'La messagerie avec les clients arrive bientôt.' },
  { chemin: '/appels', libelle: 'Appels', icone: 'tel', texte: 'Les appels vidéo avec les clients arrivent bientôt.' },
  { chemin: '/catalogue', libelle: 'Catalogue', icone: 'catalogue', texte: 'La gestion du catalogue arrive bientôt.' },
  { chemin: '/vitrine', libelle: 'Vitrine', icone: 'realisations', texte: 'La gestion des réalisations arrive bientôt.' },
  { chemin: '/actualites', libelle: 'Actualités', icone: 'actualites', texte: 'La publication des actualités arrive bientôt.' },
  { chemin: '/contenus', libelle: 'Contenus du site', icone: 'contenus', texte: 'La modification des contenus du site arrive bientôt.' },
  { chemin: '/contact', libelle: 'Demandes de contact', icone: 'contact', texte: 'Les demandes de contact arrivent bientôt.' },
  { chemin: '/paiements', libelle: 'Paiements', icone: 'paiements', texte: 'Le suivi des paiements CamPay arrive bientôt.' },
  { chemin: '/statistiques', libelle: 'Statistiques', icone: 'statistiques', texte: 'Les statistiques arrivent bientôt.' },
  { chemin: '/notifications', libelle: 'Notifications', icone: 'notifications', texte: 'Les notifications arrivent bientôt.' },
  { chemin: '/assistant', libelle: 'Assistant IA', icone: 'assistant', texte: "Le suivi de l'assistant IA arrive bientôt." },
];

/** Entrées actives visibles pour cette personne. */
export const modulesVisibles = (superAdmin) => MODULES_ACTIFS.filter((m) => !m.superAdmin || superAdmin);
