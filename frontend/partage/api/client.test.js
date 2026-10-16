// Tests du client API commun : jetons, rafraîchissement, erreurs. `fetch` est simulé.
import {
  CHEMINS,
  ErreurApi,
  creerClientApi,
  erreursChamps,
  messageParStatut,
  premierMessage,
  resultats,
} from './client.js';

const BASE = 'http://api.test';
const CLE = 'test.jetons';

/** Réponse HTTP simulée (JSON par défaut). */
function reponse(status, corps, type = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nom) => (nom.toLowerCase() === 'content-type' ? type : null) },
    json: async () => {
      if (corps === undefined) throw new SyntaxError('vide');
      return corps;
    },
  };
}

function client(fetch) {
  return creerClientApi({ baseUrl: `${BASE}/`, cleStockage: 'test', fetch });
}

const lireStockage = () => JSON.parse(localStorage.getItem(CLE));
const ranger = (jetons) => localStorage.setItem(CLE, JSON.stringify(jetons));

describe('fonctions utilitaires', () => {
  it('messageParStatut : messages en français selon le code', () => {
    expect(messageParStatut(0)).toMatch(/Connexion au serveur impossible/);
    expect(messageParStatut(401)).toMatch(/session a expiré/);
    expect(messageParStatut(403)).toMatch(/pas accès/);
    expect(messageParStatut(404)).toBe('Élément introuvable.');
    expect(messageParStatut(429)).toMatch(/Trop de tentatives/);
    expect(messageParStatut(501)).toBe('Bientôt disponible.');
    expect(messageParStatut(502)).toMatch(/serveur rencontre un problème/);
    expect(messageParStatut(418)).toBe('Une erreur est survenue. Réessayez.');
  });

  it('premierMessage : detail, non_field_errors, premier champ, listes imbriquées', () => {
    expect(premierMessage(null)).toBe('');
    expect(premierMessage('texte')).toBe('texte');
    expect(premierMessage([])).toBe('');
    expect(premierMessage({ detail: 'Refusé.' })).toBe('Refusé.');
    expect(premierMessage({ non_field_errors: ['Global.'] })).toBe('Global.');
    expect(premierMessage({ email: ['Déjà utilisé.', 'autre'] })).toBe('Déjà utilisé.');
    expect(premierMessage({ adresse: { ville: ['Ville ?'] } })).toBe('Ville ?');
    expect(premierMessage({})).toBe('');
    expect(premierMessage(42)).toBe('');
  });

  it('resultats : liste paginée, liste simple, vide', () => {
    expect(resultats({ results: [1, 2] })).toEqual([1, 2]);
    expect(resultats([3])).toEqual([3]);
    expect(resultats(null)).toEqual([]);
    expect(resultats({ count: 0 })).toEqual([]);
  });

  it('ErreurApi : message lisible, champs, jamais de détail technique pour une 5xx', () => {
    const e = new ErreurApi(400, { email: ['Un compte existe déjà.'], ville: 'La ville est obligatoire.', detail: 'x' });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ErreurApi');
    expect(e.statut).toBe(400);
    expect(e.message).toBe('x');
    expect(e.champs).toEqual({ email: 'Un compte existe déjà.', ville: 'La ville est obligatoire.' });

    const serveur = new ErreurApi(500, { detail: 'Traceback (most recent call last)…' });
    expect(serveur.message).toBe(messageParStatut(500));

    expect(new ErreurApi(400, {}).message).toBe(messageParStatut(400));
    expect(new ErreurApi(0).message).toBe(messageParStatut(0));
  });

  it('erreursChamps : vide pour une erreur sans corps objet', () => {
    expect(erreursChamps(null)).toEqual({});
    expect(erreursChamps(new ErreurApi(400, ['liste']))).toEqual({});
    expect(erreursChamps(new ErreurApi(400, { non_field_errors: ['x'] }))).toEqual({});
  });

  it('CHEMINS correspond aux routes du back-end', () => {
    expect(CHEMINS).toEqual({
      connexion: '/api/comptes/connexion/',
      connexionEquipe: '/api/admin/comptes/connexion/',
      rafraichir: '/api/comptes/connexion/rafraichir/',
      deconnexion: '/api/comptes/deconnexion/',
    });
  });
});

describe('requêtes', () => {
  it('ajoute la racine sans double barre, Accept JSON et le jeton Bearer', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn().mockResolvedValue(reponse(200, { ok: true }));
    const api = client(fetch);
    expect(api.baseUrl).toBe(BASE);
    await expect(api.get('/api/comptes/moi/')).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/comptes/moi/`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer A1');
    expect(init.headers.Accept).toBe('application/json');
    expect(init.body).toBeUndefined();
  });

  it("n'envoie pas de jeton quand auth est false ou sans jetons", async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn().mockResolvedValue(reponse(200, {}));
    const api = client(fetch);
    await api.get('/api/x/', { auth: false });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    localStorage.clear();
    await api.get('/api/x/');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('post/put/patch envoient du JSON, supprimer utilise DELETE et 204 donne null', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(200, { id: 1 }));
    const api = client(fetch);
    await api.post('/a/', { x: 1 });
    await api.put('/a/', { x: 2 });
    await api.patch('/a/', { x: 3 });
    expect(fetch.mock.calls.map((c) => c[1].method)).toEqual(['POST', 'PUT', 'PATCH']);
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ x: 3 });

    fetch.mockResolvedValueOnce(reponse(204));
    await expect(api.supprimer('/a/1/')).resolves.toBeNull();
    expect(fetch.mock.calls[3][1].method).toBe('DELETE');
  });

  it('envoyerFichiers : FormData sans Content-Type forcé', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(201, { id: 9 }));
    const api = client(fetch);
    const formulaire = new FormData();
    formulaire.append('image', 'contenu');
    await api.envoyerFichiers('/api/media/', formulaire);
    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(formulaire);
    expect(init.headers['Content-Type']).toBeUndefined();
    await api.envoyerFichiers('/api/media/1/', formulaire, { methode: 'PATCH' });
    expect(fetch.mock.calls[1][1].method).toBe('PATCH');
  });

  it('laisse une URL absolue telle quelle', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(200, {}));
    await client(fetch).get('https://ailleurs.test/x');
    expect(fetch.mock.calls[0][0]).toBe('https://ailleurs.test/x');
  });

  it('réponse non JSON : null', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(200, 'texte', 'text/html'));
    await expect(client(fetch).get('/x/')).resolves.toBeNull();
  });
});

describe('erreurs', () => {
  it('serveur injoignable : ErreurApi de statut 0', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const erreur = await client(fetch).get('/x/').catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.statut).toBe(0);
    expect(erreur.message).toMatch(/Connexion au serveur impossible/);
  });

  it('AbortError est relancée telle quelle', async () => {
    const abandon = new DOMException('Abandon', 'AbortError');
    const fetch = vi.fn().mockRejectedValue(abandon);
    await expect(client(fetch).get('/x/')).rejects.toBe(abandon);
  });

  it('400 : erreurs par champ de DRF', async () => {
    const fetch = vi.fn().mockResolvedValue(
      reponse(400, { email: ['Un compte existe déjà avec cette adresse e-mail.'], quartier: ['Le quartier est obligatoire.'] }),
    );
    const erreur = await client(fetch).post('/api/comptes/inscription/', {}).catch((e) => e);
    expect(erreur.statut).toBe(400);
    expect(erreur.message).toBe('Un compte existe déjà avec cette adresse e-mail.');
    expect(erreur.champs).toEqual({
      email: 'Un compte existe déjà avec cette adresse e-mail.',
      quartier: 'Le quartier est obligatoire.',
    });
  });

  it('500 avec corps non JSON : message générique', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(500, '<html>', 'text/html'));
    const erreur = await client(fetch).get('/x/').catch((e) => e);
    expect(erreur.statut).toBe(500);
    expect(erreur.donnees).toBeNull();
    expect(erreur.message).toBe(messageParStatut(500));
  });
});

describe('jetons et rafraîchissement', () => {
  it('connecter : envoie email et mot_de_passe sans jeton, range acces et rafraichissement', async () => {
    ranger({ acces: 'ANCIEN', rafraichissement: 'ANCIEN' });
    const corps = { acces: 'A1', rafraichissement: 'R1', utilisateur: { email: 'a@b.cm' } };
    const fetch = vi.fn().mockResolvedValue(reponse(200, corps));
    const api = client(fetch);
    const abonne = vi.fn();
    api.jetons.abonner(abonne);
    await expect(api.connecter({ email: 'a@b.cm', mot_de_passe: 'secret123' })).resolves.toEqual(corps);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/comptes/connexion/`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.cm', mot_de_passe: 'secret123' });
    expect(init.headers.Authorization).toBeUndefined();
    expect(lireStockage()).toEqual({ acces: 'A1', rafraichissement: 'R1' });
    expect(abonne).toHaveBeenCalledWith({ acces: 'A1', rafraichissement: 'R1' });
  });

  it("connecter : route de l'équipe et 401 sans tentative de rafraîchissement", async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(401, { detail: 'E-mail ou mot de passe incorrect.' }));
    const api = client(fetch);
    const erreur = await api.connecter({ email: 'a@b.cm', mot_de_passe: 'x' }, { chemin: CHEMINS.connexionEquipe }).catch((e) => e);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`${BASE}/api/admin/comptes/connexion/`);
    expect(erreur.statut).toBe(401);
    expect(erreur.message).toBe('E-mail ou mot de passe incorrect.');
    expect(api.jetons.lire()).toBeNull();
  });

  it('401 : rafraîchit puis rejoue la requête avec le nouveau jeton (rotation)', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn(async (url, init) => {
      if (url.endsWith(CHEMINS.rafraichir)) return reponse(200, { acces: 'A2', rafraichissement: 'R2' });
      return init.headers.Authorization === 'Bearer A2' ? reponse(200, { moi: 1 }) : reponse(401, { detail: 'expiré' });
    });
    const api = client(fetch);
    await expect(api.get('/api/comptes/moi/')).resolves.toEqual({ moi: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
    const appelRafraichir = fetch.mock.calls[1];
    expect(appelRafraichir[0]).toBe(`${BASE}${CHEMINS.rafraichir}`);
    expect(appelRafraichir[1].method).toBe('POST');
    expect(JSON.parse(appelRafraichir[1].body)).toEqual({ rafraichissement: 'R1' });
    expect(appelRafraichir[1].headers.Authorization).toBeUndefined();
    expect(lireStockage()).toEqual({ acces: 'A2', rafraichissement: 'R2' });
  });

  it('garde l’ancien jeton de rafraîchissement si le serveur n’en renvoie pas', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn().mockResolvedValue(reponse(200, { acces: 'A2' }));
    const api = client(fetch);
    await expect(api.rafraichir()).resolves.toBe(true);
    expect(lireStockage()).toEqual({ acces: 'A2', rafraichissement: 'R1' });
  });

  it('un seul rafraîchissement partagé par les requêtes simultanées, puis chacune est rejouée', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    let liberer;
    const attente = new Promise((r) => { liberer = r; });
    const fetch = vi.fn(async (url, init) => {
      if (url.endsWith(CHEMINS.rafraichir)) {
        await attente;
        return reponse(200, { acces: 'A2', rafraichissement: 'R2' });
      }
      return init.headers.Authorization === 'Bearer A2' ? reponse(200, { url }) : reponse(401, {});
    });
    const api = client(fetch);
    const promesses = [api.get('/a/'), api.get('/b/'), api.get('/c/')];
    await vi.waitFor(() => expect(fetch.mock.calls.filter(([u]) => u.endsWith(CHEMINS.rafraichir))).toHaveLength(1));
    liberer();
    const resultatsObtenus = await Promise.all(promesses);
    expect(resultatsObtenus.map((r) => r.url)).toEqual([`${BASE}/a/`, `${BASE}/b/`, `${BASE}/c/`]);
    expect(fetch.mock.calls.filter(([u]) => u.endsWith(CHEMINS.rafraichir))).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(7); // 3 essais + 1 rafraîchissement + 3 rejeux
  });

  it('rejoue une seule fois : un second 401 est renvoyé en erreur', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn(async (url) => (url.endsWith(CHEMINS.rafraichir)
      ? reponse(200, { acces: 'A2', rafraichissement: 'R2' })
      : reponse(401, { detail: 'Jeton invalide.' })));
    const erreur = await client(fetch).get('/x/').catch((e) => e);
    expect(erreur.statut).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rafraîchissement refusé : jetons effacés, abonnés prévenus avec null, erreur 401', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn(async (url) => (url.endsWith(CHEMINS.rafraichir)
      ? reponse(401, { detail: 'Le jeton est invalide ou expiré', code: 'token_not_valid' })
      : reponse(401, { detail: 'expiré' })));
    const api = client(fetch);
    const abonne = vi.fn();
    api.jetons.abonner(abonne);
    const erreur = await api.get('/x/').catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.statut).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(CLE)).toBeNull();
    expect(abonne).toHaveBeenCalledWith(null);
  });

  it('réseau coupé pendant le rafraîchissement : jetons conservés', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const api = client(fetch);
    await expect(api.rafraichir()).resolves.toBe(false);
    expect(lireStockage()).toEqual({ acces: 'A1', rafraichissement: 'R1' });
  });

  it('sans jeton de rafraîchissement : pas d’appel, false', async () => {
    const fetch = vi.fn();
    const api = client(fetch);
    await expect(api.rafraichir()).resolves.toBe(false);
    fetch.mockResolvedValue(reponse(401, {}));
    await expect(api.get('/x/')).rejects.toMatchObject({ statut: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('déconnecter : met en liste noire puis efface, même si le serveur échoue', async () => {
    ranger({ acces: 'A1', rafraichissement: 'R1' });
    const fetch = vi.fn().mockResolvedValue(reponse(200, {}));
    const api = client(fetch);
    await api.deconnecter();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/comptes/deconnexion/`);
    expect(JSON.parse(init.body)).toEqual({ rafraichissement: 'R1' });
    expect(api.jetons.lire()).toBeNull();

    ranger({ acces: 'A1', rafraichissement: 'R1' });
    fetch.mockRejectedValueOnce(new TypeError('hors ligne'));
    await expect(api.deconnecter()).resolves.toBeUndefined();
    expect(api.jetons.lire()).toBeNull();
  });

  it('retenirJetons, lecture tolérante et désabonnement', () => {
    const api = client(vi.fn());
    const abonne = vi.fn();
    const desabonner = api.jetons.abonner(abonne);
    api.retenirJetons({ utilisateur: {} }); // pas de jeton : rien
    expect(api.jetons.lire()).toBeNull();
    api.retenirJetons({ acces: 'A', rafraichissement: 'R', utilisateur: {} });
    expect(api.jetons.lire()).toEqual({ acces: 'A', rafraichissement: 'R' });
    desabonner();
    api.jetons.effacer();
    expect(abonne).toHaveBeenCalledTimes(1);

    localStorage.setItem(CLE, '{pas du json');
    expect(api.jetons.lire()).toBeNull();
  });

  it('stockage indisponible : pas d’exception, les abonnés sont prévenus', () => {
    const api = client(vi.fn());
    const abonne = vi.fn();
    api.jetons.abonner(abonne);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => api.jetons.ecrire({ acces: 'A', rafraichissement: 'R' })).not.toThrow();
    expect(abonne).toHaveBeenCalledWith({ acces: 'A', rafraichissement: 'R' });
  });
});

describe('premierMessage : listes imbriquées', () => {
  it("saute les lignes sans erreur d'une liste imbriquée", () => {
    const donnees = { caracteristiques: [{}, { libelle: ['Ce champ est obligatoire.'] }] };
    expect(premierMessage(donnees)).toBe('Ce champ est obligatoire.');
    expect(erreursChamps(new ErreurApi(400, donnees))).toEqual({ caracteristiques: 'Ce champ est obligatoire.' });
    expect(premierMessage([{}, []])).toBe('');
  });
});
