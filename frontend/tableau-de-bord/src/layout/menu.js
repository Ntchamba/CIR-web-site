// Entrées du menu latéral. Les modules des vagues suivantes sont listés « Bientôt disponible » :
// leur page affiche un simple message en attendant (voir routes.jsx).
// `libelle` et `texte` sont lus dans la langue courante (clés modules.<module>.libelle / .texte).
import { t } from '@/i18n/index.js';

function entree(module, chemin, icone, extra = {}) {
  return {
    module,
    chemin,
    icone,
    ...extra,
    get libelle() { return t(`modules.${module}.libelle`); },
    get texte() { return t(`modules.${module}.texte`); },
  };
}

/**
 * Modules livrés. `superAdmin` : entrée visible seulement pour le super-administrateur.
 * `pastille` : le menu affiche le nombre d'éléments à traiter (voir usePastilles.js) ; `pastilleTexte` : clé du texte
 * lu par les lecteurs d'écran (coque.aTraiter par défaut, coque.nonLus, coque.nonLues).
 */
export const MODULES_ACTIFS = [
  entree('accueil', '/', 'accueil', { fin: true }),
  entree('commandes', '/commandes', 'commandes', { pastille: true }),
  entree('devis', '/devis', 'devis', { pastille: true }),
  entree('contact', '/contact', 'contact', { pastille: true }),
  entree('messagerie', '/messagerie', 'message', { pastille: true, pastilleTexte: 'nonLus' }),
  entree('appels', '/appels', 'tel', { pastille: true }),
  entree('notifications', '/notifications', 'notifications', { pastille: true, pastilleTexte: 'nonLues' }),
  entree('paiements', '/paiements', 'paiements', { pastille: true }),
  entree('statistiques', '/statistiques', 'statistiques'),
  entree('clients', '/clients', 'clients'),
  entree('catalogue', '/catalogue', 'catalogue'),
  entree('vitrine', '/vitrine', 'realisations'),
  entree('actualites', '/actualites', 'actualites'),
  entree('contenus', '/contenus', 'contenus'),
  entree('assistant', '/assistant', 'assistant'),
  entree('equipe', '/equipe', 'equipe', { superAdmin: true }),
];

/** Modules des vagues suivantes (vide depuis la vague 5 : tous les modules sont livrés ; la section « À venir » disparaît). */
export const MODULES_A_VENIR = [];

/** Entrées actives visibles pour cette personne. */
export const modulesVisibles = (superAdmin) => MODULES_ACTIFS.filter((m) => !m.superAdmin || superAdmin);
