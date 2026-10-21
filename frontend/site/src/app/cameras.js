// Cadrages de la « caméra » : une seule scène continue (le salon, dernière image de la vidéo), et chaque page est un
// endroit différent où la caméra nous amène en marchant. Définis ICI et nulle part ailleurs.
//
// Coordonnées : `x` et `y` en % de l'image (point amené au centre de l'écran), `zoom` ≥ 1 (1 = plan large).
// Bureau : image 1280 x 720 (fond-maison-desktop.webp) ; téléphone : 540 x 960 en portrait (fond-maison-mobile.webp,
// où les escaliers ne sont pas dans le cadre : la porte et le mur de gauche les remplacent). Zones de l'image de bureau :
// escaliers et rampe à gauche (x 15 à 40 %), fenêtres à droite (x 55 à 100 %, grande fenêtre centrale vers 74 %),
// lustre en haut (x 69 %), canapés au milieu à droite (y 47 à 58 %), sol marbré et bidons en bas (y 60 à 95 %).

/** Plan large (page inconnue, premier chargement, état de départ). */
export const PLAN_LARGE = { x: 50, y: 50, zoom: 1 };

// `motif` : chemin avec :parametre ; l'ordre compte (le plus précis d'abord). Deux pages voisines ne partagent jamais
// exactement le même cadrage (décalage de 4 à 5 % au moins).
export const CAMERAS = [
  { motif: '/', nom: 'accueil', bureau: { x: 74, y: 33, zoom: 1 }, tel: { x: 58, y: 31, zoom: 1 } }, // large, puis zoom (défilement) sur les fenêtres
  { motif: '/catalogue', nom: 'catalogue', bureau: { x: 26, y: 42, zoom: 1.7 }, tel: { x: 27, y: 42, zoom: 1.5 } },
  { motif: '/selection', nom: 'selection', bureau: { x: 31, y: 46, zoom: 1.9 }, tel: { x: 31, y: 47, zoom: 1.5 } },
  { motif: '/catalogue/:slug', nom: 'produit', bureau: { x: 20, y: 33, zoom: 3 }, tel: { x: 14, y: 52, zoom: 1.8 } },
  { motif: '/realisations', nom: 'realisations', bureau: { x: 70, y: 55, zoom: 1.7 }, tel: { x: 46, y: 55, zoom: 1.6 } },
  { motif: '/actualites', nom: 'actualites', bureau: { x: 69, y: 9, zoom: 2.4 }, tel: { x: 80, y: 9, zoom: 1.7 } },
  { motif: '/actualites/:slug', nom: 'actualite', bureau: { x: 64, y: 12, zoom: 2.7 }, tel: { x: 74, y: 12, zoom: 1.8 } },
  { motif: '/commandes', nom: 'commandes', bureau: { x: 52, y: 66, zoom: 1.6 }, tel: { x: 57, y: 82, zoom: 1.6 } },
  { motif: '/commandes/nouvelle', nom: 'nouvelle-commande', bureau: { x: 55, y: 84, zoom: 2.5 }, tel: { x: 50, y: 85, zoom: 1.7 } },
  { motif: '/commandes/:id', nom: 'commande', bureau: { x: 65, y: 76, zoom: 2.5 }, tel: { x: 63, y: 78, zoom: 1.7 } },
  { motif: '/commandes/:id/payer', nom: 'paiement', bureau: { x: 50, y: 78, zoom: 2.8 }, tel: { x: 52, y: 76, zoom: 1.8 } },
  { motif: '/paiements/:id/recu', nom: 'recu', bureau: { x: 66, y: 84, zoom: 2.8 }, tel: { x: 66, y: 84, zoom: 1.8 } },
  { motif: '/devis/demande', nom: 'devis', bureau: { x: 45, y: 82, zoom: 2.4 }, tel: { x: 44, y: 80, zoom: 1.7 } },
  { motif: '/contact', nom: 'contact', bureau: { x: 72, y: 31, zoom: 2.6 }, tel: { x: 58, y: 31, zoom: 1.8 } },
  { motif: '/messages', nom: 'messagerie', bureau: { x: 78, y: 36, zoom: 2.8 }, tel: { x: 64, y: 36, zoom: 1.9 } },
  { motif: '/notifications', nom: 'notifications', bureau: { x: 66, y: 26, zoom: 2.4 }, tel: { x: 52, y: 26, zoom: 1.7 } },
  { motif: '/mes-demandes', nom: 'demandes', bureau: { x: 68, y: 38, zoom: 2.2 }, tel: { x: 54, y: 38, zoom: 1.6 } },
  { motif: '/connexion', nom: 'connexion', bureau: { x: 58, y: 62, zoom: 1.3 }, tel: { x: 88, y: 42, zoom: 1.7 } },
  { motif: '/inscription', nom: 'inscription', bureau: { x: 66, y: 66, zoom: 1.45 }, tel: { x: 92, y: 48, zoom: 1.8 } },
  { motif: '/compte', nom: 'compte', bureau: { x: 83, y: 46, zoom: 2.2 }, tel: { x: 83, y: 38, zoom: 1.6 } },
];

const ECRAN_TEL = '(max-width: 900px)';
export const estTelephone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia(ECRAN_TEL).matches;

function correspond(motif, chemin) {
  const a = motif.split('/').filter(Boolean);
  const b = chemin.split('/').filter(Boolean);
  return a.length === b.length && a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}

/** Cadrage de la page (`tel` : version portrait). Page inconnue : plan large. */
export function cadrageDe(chemin, tel = false) {
  const route = CAMERAS.find((c) => correspond(c.motif, chemin));
  return route ? route[tel ? 'tel' : 'bureau'] : PLAN_LARGE;
}

/** Nom de la vue (« accueil », « catalogue »… ou « inconnue »). */
export const nomDeVue = (chemin) => CAMERAS.find((c) => correspond(c.motif, chemin))?.nom ?? 'inconnue';

/** Décalage maximal (en % de l'écran) qui garde l'image pleine : jamais de bord visible. */
const borne = (zoom) => (zoom - 1) * 50;
const entre = (v, m) => Math.max(-m, Math.min(m, v));

/** Translation (en % de l'écran) et échelle de la scène pour un cadrage : même calcul que le CSS de `.scene-image`. */
export function transformDe({ x, y, zoom }) {
  return {
    tx: entre((50 - x) * zoom, borne(zoom)),
    ty: entre((50 - y) * zoom, borne(zoom)),
    echelle: zoom,
  };
}
