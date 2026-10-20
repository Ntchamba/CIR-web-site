// Tests de la connexion en direct : authentification par première trame, ping, reconnexion, file d'attente.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adresseDirect, creerConnexionDirect } from './socket.js';

class FauxSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.envoyes = [];
    this.fermeAvec = null;
    FauxSocket.instances.push(this);
  }
  send(donnees) {
    this.envoyes.push(JSON.parse(donnees));
  }
  close(code) {
    this.fermeAvec = code;
    this.onclose?.({ code });
  }
  ouvrir() {
    this.onopen?.();
  }
  recevoir(trame) {
    this.onmessage?.({ data: JSON.stringify(trame) });
  }
  couper() {
    this.onclose?.({ code: 1006 });
  }
}

function faireApi(jetons = { acces: 'jeton-1', rafraichissement: 'r' }) {
  const etat = { jetons };
  return {
    baseUrl: 'https://api.test',
    jetons: { lire: () => etat.jetons },
    rafraichir: vi.fn(async () => {
      if (etat.jetons) etat.jetons = { ...etat.jetons, acces: 'jeton-2' };
      return Boolean(etat.jetons);
    }),
    etat,
  };
}

function demarrer(api = faireApi()) {
  const evenements = [];
  const etats = [];
  const direct = creerConnexionDirect({
    api,
    surEvenement: (t) => evenements.push(t),
    surEtat: (e) => etats.push(e),
    WebSocketImpl: FauxSocket,
  });
  return { api, direct, evenements, etats };
}

describe('adresseDirect', () => {
  it('convertit http en ws et https en wss', () => {
    expect(adresseDirect('http://localhost:8000/')).toBe('ws://localhost:8000/ws/');
    expect(adresseDirect('https://api.revelation-sarl.com')).toBe('wss://api.revelation-sarl.com/ws/');
  });
  it("utilise l'origine locale sans adresse de back-end", () => {
    expect(adresseDirect('', 'https://site.test')).toBe('wss://site.test/ws/');
  });
});

describe('creerConnexionDirect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FauxSocket.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  it("s'authentifie par la première trame, sans jeton dans l'adresse", () => {
    const { etats } = demarrer();
    const s = FauxSocket.instances[0];
    expect(s.url).toBe('wss://api.test/ws/');
    expect(s.url).not.toContain('jeton');
    s.ouvrir();
    expect(s.envoyes[0]).toEqual({ type: 'authentifier', jeton: 'jeton-1' });
    s.recevoir({ type: 'pret' });
    expect(etats).toEqual(['connexion', 'connecte']);
  });

  it('transmet les trames du serveur, sauf pong', () => {
    const { evenements } = demarrer();
    const s = FauxSocket.instances[0];
    s.ouvrir();
    s.recevoir({ type: 'pret' });
    s.recevoir({ type: 'pong' });
    s.recevoir({ type: 'message', message: { id: 1 } });
    expect(evenements.map((e) => e.type)).toEqual(['pret', 'message']);
  });

  it('envoie un ping toutes les 25 secondes', () => {
    demarrer();
    const s = FauxSocket.instances[0];
    s.ouvrir();
    s.recevoir({ type: 'pret' });
    vi.advanceTimersByTime(50_000);
    expect(s.envoyes.filter((t) => t.type === 'ping')).toHaveLength(2);
  });

  it("garde les trames pendant la connexion et les envoie une fois prêt", () => {
    const { direct } = demarrer();
    const s = FauxSocket.instances[0];
    expect(direct.envoyer({ type: 'ecrit' })).toBe(false);
    s.ouvrir();
    expect(s.envoyes).toHaveLength(1);
    s.recevoir({ type: 'pret' });
    expect(s.envoyes[1]).toEqual({ type: 'ecrit' });
    expect(direct.envoyer({ type: 'lu', jusqu_a: 3 })).toBe(true);
  });

  it('limite la file à 20 trames en gardant les plus récentes', () => {
    const { direct } = demarrer();
    for (let i = 0; i < 25; i += 1) direct.envoyer({ type: 'ecrit', n: i });
    const s = FauxSocket.instances[0];
    s.ouvrir();
    s.recevoir({ type: 'pret' });
    const envoyes = s.envoyes.filter((t) => t.type === 'ecrit');
    expect(envoyes).toHaveLength(20);
    expect(envoyes[0].n).toBe(5);
  });

  it('se reconnecte avec un délai croissant et un jeton renouvelé', async () => {
    const { api, etats } = demarrer();
    const s1 = FauxSocket.instances[0];
    s1.ouvrir();
    s1.recevoir({ type: 'pret' });
    s1.couper();
    expect(etats.at(-1)).toBe('coupe');
    await vi.advanceTimersByTimeAsync(999);
    expect(FauxSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.rafraichir).toHaveBeenCalledTimes(1);
    expect(FauxSocket.instances).toHaveLength(2);
    const s2 = FauxSocket.instances[1];
    s2.ouvrir();
    expect(s2.envoyes[0].jeton).toBe('jeton-2');
    // Échec sans « pret » : le délai double.
    s2.couper();
    await vi.advanceTimersByTimeAsync(1999);
    expect(FauxSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FauxSocket.instances).toHaveLength(3);
  });

  it('remet le délai à 1 seconde après une connexion réussie et plafonne à 30 secondes', async () => {
    demarrer();
    for (let i = 0; i < 8; i += 1) {
      FauxSocket.instances.at(-1).couper();
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(FauxSocket.instances).toHaveLength(9);
    const s = FauxSocket.instances.at(-1);
    s.ouvrir();
    s.recevoir({ type: 'pret' });
    s.couper();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FauxSocket.instances).toHaveLength(10);
  });

  it("s'arrête si la session est terminée pendant la coupure", async () => {
    const api = faireApi();
    const { etats } = demarrer(api);
    FauxSocket.instances[0].couper();
    api.etat.jetons = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(FauxSocket.instances).toHaveLength(1);
    expect(etats.at(-1)).toBe('coupe');
  });

  it("n'ouvre rien sans jeton", () => {
    demarrer(faireApi(null));
    expect(FauxSocket.instances).toHaveLength(0);
  });

  it('fermer coupe la connexion, arrête le ping et ne se reconnecte pas', async () => {
    const { direct } = demarrer();
    const s = FauxSocket.instances[0];
    s.ouvrir();
    s.recevoir({ type: 'pret' });
    direct.fermer();
    expect(s.fermeAvec).toBe(1000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FauxSocket.instances).toHaveLength(1);
    expect(s.envoyes.filter((t) => t.type === 'ping')).toHaveLength(0);
    expect(direct.etat()).toBe('coupe');
  });

  it('ignore une ancienne connexion une fois remplacée', async () => {
    const { evenements } = demarrer();
    const ancienne = FauxSocket.instances[0];
    ancienne.couper();
    await vi.advanceTimersByTimeAsync(1000);
    ancienne.recevoir({ type: 'message', message: { id: 9 } });
    expect(evenements).toHaveLength(0);
  });

  it('ignore les trames illisibles', () => {
    const { evenements } = demarrer();
    const s = FauxSocket.instances[0];
    s.onmessage({ data: 'pas du json' });
    s.onmessage({ data: '12' });
    expect(evenements).toHaveLength(0);
  });
});
