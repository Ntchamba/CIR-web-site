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

/** Modules livrés. `superAdmin` : entrée visible seulement pour le super-administrateur. */
export const MODULES_ACTIFS = [
  entree('accueil', '/', 'accueil', { fin: true }),
  entree('clients', '/clients', 'clients'),
  entree('catalogue', '/catalogue', 'catalogue'),
  entree('vitrine', '/vitrine', 'realisations'),
  entree('actualites', '/actualites', 'actualites'),
  entree('contenus', '/contenus', 'contenus'),
  entree('equipe', '/equipe', 'equipe', { superAdmin: true }),
];

export const MODULES_A_VENIR = [
  entree('commandes', '/commandes', 'commandes'),
  entree('devis', '/devis', 'devis'),
  entree('messagerie', '/messagerie', 'message'),
  entree('appels', '/appels', 'tel'),
  entree('contact', '/contact', 'contact'),
  entree('paiements', '/paiements', 'paiements'),
  entree('statistiques', '/statistiques', 'statistiques'),
  entree('notifications', '/notifications', 'notifications'),
  entree('assistant', '/assistant', 'assistant'),
];

/** Entrées actives visibles pour cette personne. */
export const modulesVisibles = (superAdmin) => MODULES_ACTIFS.filter((m) => !m.superAdmin || superAdmin);
