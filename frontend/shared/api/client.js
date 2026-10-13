/**
 * Client HTTP de l'API CIR, commun au site et au dashboard.
 * - ajoute le jeton JWT à chaque requête ;
 * - renouvelle le jeton d'accès quand il expire (une seule fois par requête) ;
 * - renvoie les erreurs sous forme lisible (ErreurApi.message).
 */

export class ErreurApi extends Error {
  constructor(statut, donnees) {
    super(premierMessage(donnees) || messageParStatut(statut));
    this.statut = statut;
    this.donnees = donnees;
  }
}

function messageParStatut(statut) {
  if (statut === 0) return 'Connexion impossible. Vérifiez votre accès à Internet.';
  if (statut === 401) return 'Votre session a expiré. Reconnectez-vous.';
  if (statut === 403) return "Vous n'avez pas accès à cette page.";
  if (statut === 404) return 'Élément introuvable.';
  if (statut === 429) return 'Trop de tentatives. Réessayez un peu plus tard.';
  if (statut === 501) return 'Bientôt disponible.';
  return 'Une erreur est survenue. Réessayez.';
}

/** Trouve le premier message d'erreur dans une réponse Django REST Framework. */
export function premierMessage(donnees) {
  if (!donnees) return '';
  if (typeof donnees === 'string') return donnees;
  if (Array.isArray(donnees)) return premierMessage(donnees[0]);
  if (donnees.detail) return premierMessage(donnees.detail);
  if (donnees.non_field_errors) return premierMessage(donnees.non_field_errors);
  const premier = Object.values(donnees)[0];
  return premierMessage(premier);
}

export function creerClientApi({ baseUrl, cleStockage = 'cir', cheminRafraichir = '/comptes/jeton/rafraichir/' }) {
  const cle = `${cleStockage}.jetons`;
  const abonnes = new Set();

  const lireJetons = () => {
    try { return JSON.parse(localStorage.getItem(cle)) || null; } catch { return null; }
  };
  const ecrireJetons = (jetons) => {
    try {
      if (jetons) localStorage.setItem(cle, JSON.stringify(jetons));
      else localStorage.removeItem(cle);
    } catch { /* stockage indisponible : la session dure le temps de l'onglet */ }
    abonnes.forEach((f) => f(jetons));
  };

  let rafraichissementEnCours = null;
  async function rafraichir() {
    const jetons = lireJetons();
    if (!jetons?.refresh) return false;
    rafraichissementEnCours ??= fetch(baseUrl + cheminRafraichir, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: jetons.refresh }),
    })
      .then(async (r) => {
        if (!r.ok) { ecrireJetons(null); return false; }
        const nouveaux = await r.json();
        ecrireJetons({ access: nouveaux.access, refresh: nouveaux.refresh || jetons.refresh });
        return true;
      })
      .catch(() => false)
      .finally(() => { rafraichissementEnCours = null; });
    return rafraichissementEnCours;
  }

  async function requete(chemin, { methode = 'GET', corps, formulaire, auth = true, signal, deuxiemeEssai } = {}) {
    const entetes = { Accept: 'application/json' };
    const jetons = lireJetons();
    if (auth && jetons?.access) entetes.Authorization = `Bearer ${jetons.access}`;
    let body;
    if (formulaire) body = formulaire;
    else if (corps !== undefined) { entetes['Content-Type'] = 'application/json'; body = JSON.stringify(corps); }

    let reponse;
    try {
      reponse = await fetch(chemin.startsWith('http') ? chemin : baseUrl + chemin, {
        method: methode, headers: entetes, body, signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new ErreurApi(0, null);
    }

    if (reponse.status === 401 && auth && jetons?.refresh && !deuxiemeEssai) {
      if (await rafraichir()) return requete(chemin, { methode, corps, formulaire, auth, signal, deuxiemeEssai: true });
    }
    if (reponse.status === 204) return null;
    const type = reponse.headers.get('Content-Type') || '';
    const donnees = type.includes('json') ? await reponse.json().catch(() => null) : null;
    if (!reponse.ok) throw new ErreurApi(reponse.status, donnees);
    return donnees;
  }

  const urlWs = baseUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '');

  return {
    baseUrl,
    get: (chemin, options) => requete(chemin, options),
    post: (chemin, corps, options) => requete(chemin, { ...options, methode: 'POST', corps }),
    patch: (chemin, corps, options) => requete(chemin, { ...options, methode: 'PATCH', corps }),
    put: (chemin, corps, options) => requete(chemin, { ...options, methode: 'PUT', corps }),
    supprimer: (chemin, options) => requete(chemin, { ...options, methode: 'DELETE' }),
    envoyerFichiers: (chemin, formulaire, methode = 'POST') => requete(chemin, { methode, formulaire }),
    jetons: { lire: lireJetons, ecrire: ecrireJetons, abonner: (f) => { abonnes.add(f); return () => abonnes.delete(f); } },
    /** Adresse WebSocket authentifiée, ex. ws('/ws/messagerie/3/'). */
    ws: (chemin) => `${urlWs}${chemin}?jeton=${encodeURIComponent(lireJetons()?.access || '')}`,
    rafraichir,
  };
}

/** Récupère toutes les pages d'une liste paginée (?page=…) ou renvoie la liste telle quelle. */
export function resultats(donnees) {
  if (!donnees) return [];
  return Array.isArray(donnees) ? donnees : donnees.results || [];
}
