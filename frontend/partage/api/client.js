/**
 * Client HTTP de l'API CIR, commun au site public et au tableau de bord.
 *
 * - ajoute le jeton d'accès JWT (« Bearer ») à chaque requête authentifiée ;
 * - sur une réponse 401, renouvelle le jeton d'accès avec le jeton de rafraîchissement
 *   (une seule demande à la fois, partagée par les requêtes en attente), puis rejoue la requête une fois ;
 * - si le renouvellement échoue, efface les jetons (les abonnés sont prévenus : déconnexion) ;
 * - transforme toute erreur en `ErreurApi` dont le `message` est lisible, en français.
 *
 * Jetons rangés dans localStorage sous « <cleStockage>.jetons » : { acces, rafraichissement }.
 *
 * Usage :
 *   const api = creerClientApi({ baseUrl: import.meta.env.VITE_API_URL, cleStockage: 'cir-site' });
 *   const { utilisateur } = await api.connecter({ email, mot_de_passe });
 *   const moi = await api.get('/api/comptes/moi/');
 *   await api.deconnecter();
 */

/** Chemins de l'API des comptes (champs en français : mot_de_passe, acces, rafraichissement). */
export const CHEMINS = {
  connexion: '/api/comptes/connexion/',
  connexionEquipe: '/api/admin/comptes/connexion/', // tableau de bord : 403 pour un compte client
  rafraichir: '/api/comptes/connexion/rafraichir/',
  deconnexion: '/api/comptes/deconnexion/',
};
export const CHEMIN_RAFRAICHIR = CHEMINS.rafraichir;

/** Messages par défaut, selon le code HTTP (0 = pas de réponse du serveur). */
export function messageParStatut(statut) {
  if (statut === 0) return 'Connexion au serveur impossible. Vérifiez votre accès à Internet et réessayez.';
  if (statut === 400) return 'Certaines informations sont incorrectes. Vérifiez le formulaire.';
  if (statut === 401) return 'Votre session a expiré. Reconnectez-vous.';
  if (statut === 403) return "Vous n'avez pas accès à cette action.";
  if (statut === 404) return 'Élément introuvable.';
  if (statut === 413) return 'Le fichier envoyé est trop volumineux.';
  if (statut === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (statut === 501) return 'Bientôt disponible.';
  if (statut >= 500) return 'Le serveur rencontre un problème. Réessayez dans un instant.';
  return 'Une erreur est survenue. Réessayez.';
}

/** Premier message d'erreur trouvé dans une réponse Django REST Framework (chaîne, liste ou objet). */
export function premierMessage(donnees) {
  if (donnees === null || donnees === undefined) return '';
  if (typeof donnees === 'string') return donnees;
  if (Array.isArray(donnees)) return donnees.length ? premierMessage(donnees[0]) : '';
  if (typeof donnees === 'object') {
    if (donnees.detail) return premierMessage(donnees.detail);
    if (donnees.non_field_errors) return premierMessage(donnees.non_field_errors);
    const valeurs = Object.values(donnees);
    return valeurs.length ? premierMessage(valeurs[0]) : '';
  }
  return '';
}

export class ErreurApi extends Error {
  /**
   * @param {number} statut code HTTP (0 si le serveur n'a pas répondu)
   * @param {*} donnees corps de la réponse (JSON) s'il y en a un
   */
  constructor(statut, donnees = null) {
    // Les réponses 5xx de Django peuvent contenir des détails techniques en anglais : message générique.
    const message = statut >= 500 || statut === 0 ? '' : premierMessage(donnees);
    super(message || messageParStatut(statut));
    this.name = 'ErreurApi';
    this.statut = statut;
    this.donnees = donnees;
  }

  /** Erreurs par champ, ex. { email: 'Cet e-mail est déjà utilisé.' } (vide si l'erreur n'est pas liée à un champ). */
  get champs() {
    return erreursChamps(this);
  }
}

/** Erreurs par champ d'une `ErreurApi` 400 de DRF : { champ: 'premier message' }. */
export function erreursChamps(erreur) {
  const donnees = erreur?.donnees;
  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return {};
  const champs = {};
  Object.entries(donnees).forEach(([champ, valeur]) => {
    if (champ === 'detail' || champ === 'non_field_errors') return;
    const message = premierMessage(valeur);
    if (message) champs[champ] = message;
  });
  return champs;
}

/** Liste des résultats d'une réponse paginée (`{ results: [...] }`) ou d'une liste simple. */
export function resultats(donnees) {
  if (!donnees) return [];
  return Array.isArray(donnees) ? donnees : donnees.results || [];
}

/**
 * Crée un client API.
 * @param {object} options
 * @param {string} options.baseUrl adresse du back-end, ex. « http://localhost:8000 » (les chemins commencent par /api/)
 * @param {string} [options.cleStockage='cir'] préfixe de la clé localStorage des jetons (« <cle>.jetons »)
 * @param {string} [options.cheminRafraichir] chemin de renouvellement du jeton d'accès
 * @param {Function} [options.fetch] implémentation de fetch (tests)
 */
export function creerClientApi({
  baseUrl = '',
  cleStockage = 'cir',
  cheminRafraichir = CHEMIN_RAFRAICHIR,
  fetch: fetchPersonnalise,
} = {}) {
  const racine = String(baseUrl || '').replace(/\/+$/, '');
  const cle = `${cleStockage}.jetons`;
  const abonnes = new Set();
  const appeler = (...args) => (fetchPersonnalise || globalThis.fetch)(...args);
  const url = (chemin) => (/^https?:\/\//.test(chemin) ? chemin : racine + chemin);

  function lireJetons() {
    try {
      return JSON.parse(localStorage.getItem(cle)) || null;
    } catch {
      return null;
    }
  }

  function ecrireJetons(jetons) {
    try {
      if (jetons) localStorage.setItem(cle, JSON.stringify(jetons));
      else localStorage.removeItem(cle);
    } catch {
      /* stockage indisponible (navigation privée) : la session ne survivra pas au rechargement */
    }
    abonnes.forEach((rappel) => rappel(jetons));
  }

  let rafraichissementEnCours = null;

  /** Renouvelle le jeton d'accès. Renvoie true si c'est fait, false sinon (jetons effacés). */
  function rafraichir() {
    const jetons = lireJetons();
    if (!jetons?.rafraichissement) return Promise.resolve(false);
    rafraichissementEnCours ??= appeler(url(cheminRafraichir), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ rafraichissement: jetons.rafraichissement }),
    })
      .then(async (reponse) => {
        if (!reponse.ok) {
          ecrireJetons(null);
          return false;
        }
        const nouveaux = await reponse.json();
        // Rotation des jetons : le serveur peut renvoyer un nouveau jeton de rafraîchissement.
        ecrireJetons({ acces: nouveaux.acces, rafraichissement: nouveaux.rafraichissement || jetons.rafraichissement });
        return true;
      })
      .catch(() => false) // réseau coupé : on garde les jetons, la requête d'origine échouera en 401
      .finally(() => {
        rafraichissementEnCours = null;
      });
    return rafraichissementEnCours;
  }

  async function requete(chemin, { methode = 'GET', corps, formulaire, auth = true, signal, entetes: extra } = {}, rejeu = false) {
    const entetes = { Accept: 'application/json', ...extra };
    const jetons = auth ? lireJetons() : null;
    if (jetons?.acces) entetes.Authorization = `Bearer ${jetons.acces}`;
    let body;
    if (formulaire) body = formulaire;
    else if (corps !== undefined) {
      entetes['Content-Type'] = 'application/json';
      body = JSON.stringify(corps);
    }

    let reponse;
    try {
      reponse = await appeler(url(chemin), { method: methode, headers: entetes, body, signal });
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      throw new ErreurApi(0);
    }

    if (reponse.status === 401 && auth && jetons?.rafraichissement && !rejeu) {
      if (await rafraichir()) return requete(chemin, { methode, corps, formulaire, auth, signal, entetes: extra }, true);
    }

    if (reponse.status === 204) return null;
    const type = reponse.headers?.get?.('Content-Type') || '';
    const donnees = type.includes('json') ? await reponse.json().catch(() => null) : null;
    if (!reponse.ok) throw new ErreurApi(reponse.status, donnees);
    return donnees;
  }

  /**
   * Connexion : envoie { email, mot_de_passe }, range les jetons reçus et renvoie la réponse complète
   * ({ acces, rafraichissement, utilisateur }). `chemin` : CHEMINS.connexionEquipe pour le tableau de bord.
   */
  async function connecter({ email, mot_de_passe: motDePasse }, { chemin = CHEMINS.connexion } = {}) {
    const donnees = await requete(chemin, { methode: 'POST', corps: { email, mot_de_passe: motDePasse }, auth: false });
    retenirJetons(donnees);
    return donnees;
  }

  /** Range les jetons d'une réponse { acces, rafraichissement } (connexion, inscription). */
  function retenirJetons(donnees) {
    if (donnees?.acces) ecrireJetons({ acces: donnees.acces, rafraichissement: donnees.rafraichissement || null });
  }

  /** Déconnexion : met le jeton de rafraîchissement en liste noire (si possible) puis efface les jetons. */
  async function deconnecter({ chemin = CHEMINS.deconnexion } = {}) {
    const jetons = lireJetons();
    if (jetons?.rafraichissement) {
      try {
        await requete(chemin, { methode: 'POST', corps: { rafraichissement: jetons.rafraichissement }, auth: false });
      } catch {
        /* jeton déjà expiré ou réseau coupé : on efface quand même la session locale */
      }
    }
    ecrireJetons(null);
  }

  return {
    baseUrl: racine,
    connecter,
    deconnecter,
    retenirJetons,
    requete,
    get: (chemin, options) => requete(chemin, options),
    post: (chemin, corps, options) => requete(chemin, { ...options, methode: 'POST', corps }),
    put: (chemin, corps, options) => requete(chemin, { ...options, methode: 'PUT', corps }),
    patch: (chemin, corps, options) => requete(chemin, { ...options, methode: 'PATCH', corps }),
    supprimer: (chemin, options) => requete(chemin, { ...options, methode: 'DELETE' }),
    envoyerFichiers: (chemin, formulaire, options) => requete(chemin, { methode: 'POST', ...options, formulaire }),
    rafraichir,
    jetons: {
      lire: lireJetons,
      ecrire: ecrireJetons,
      effacer: () => ecrireJetons(null),
      /** Appelle `rappel(jetons)` à chaque changement ; renvoie la fonction de désabonnement. */
      abonner: (rappel) => {
        abonnes.add(rappel);
        return () => abonnes.delete(rappel);
      },
    },
  };
}
