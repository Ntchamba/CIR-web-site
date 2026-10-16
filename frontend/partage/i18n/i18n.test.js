// Tests des traductions communes : recherche des textes, variables, pluriels, changement et détection
// de la langue, fichiers de messages complets dans les cinq langues.
import { ErreurApi, creerClientApi } from '../api/client.js';
import { STATUTS, dateHeure, fcfa, prix } from '../utils/format.js';
import {
  abonner, changerLangue, detecterLangue, enregistrerMessages, existe, langueApi, langueCourante,
  localeIntl, reinitialiserI18n, t,
} from './i18n.js';
import { CODES_LANGUES, LANGUES, infosLangue, langueGeree } from './langues.js';
import de from './messages/de.js';
import en from './messages/en.js';
import fr from './messages/fr.js';
import ja from './messages/ja.js';
import zh from './messages/zh.js';
import { ecartsAvecFrancais } from './verification.js';

const n = (texte) => texte.replace(/[  ]/g, ' ');

afterEach(() => reinitialiserI18n());

describe('langues', () => {
  it('cinq langues, le français en premier, chacune écrite dans sa langue', () => {
    expect(CODES_LANGUES).toEqual(['fr', 'en', 'zh', 'de', 'ja']);
    expect(LANGUES.map((l) => l.nom)).toEqual(['Français', 'English', '中文', 'Deutsch', '日本語']);
    expect(infosLangue('zh')).toMatchObject({ intl: 'zh-CN', html: 'zh-Hans', api: 'zh-hans' });
    expect(infosLangue('xx').code).toBe('fr');
  });

  it('langueGeree : étiquettes de navigateur ramenées au code court', () => {
    expect(langueGeree('en-US')).toBe('en');
    expect(langueGeree('zh-Hans-CN')).toBe('zh');
    expect(langueGeree('zh_TW')).toBe('zh');
    expect(langueGeree('DE')).toBe('de');
    expect(langueGeree('ja-JP')).toBe('ja');
    expect(langueGeree('es-ES')).toBeNull();
    expect(langueGeree('')).toBeNull();
    expect(langueGeree(null)).toBeNull();
  });
});

describe('t', () => {
  it('français par défaut, clé pointée', () => {
    expect(langueCourante()).toBe('fr');
    expect(t('commun.reessayer')).toBe('Réessayer');
    expect(t('statuts.contrat_signe')).toBe('Contrat signé');
  });

  it('clé inconnue ou incomplète : la clé elle-même (traduction oubliée visible)', () => {
    expect(t('nexiste.pas')).toBe('nexiste.pas');
    expect(t('commun')).toBe('commun');
    expect(existe('commun.reessayer')).toBe(true);
    expect(existe('nexiste.pas')).toBe(false);
  });

  it('variables remplacées, nombres mis en forme selon la langue, variable absente laissée telle quelle', () => {
    enregistrerMessages('fr', { essai: { phrase: '{nom} a {n} chantiers {autre}' } });
    expect(n(t('essai.phrase', { nom: 'Awa', n: 1200 }))).toBe('Awa a 1 200 chantiers {autre}');
  });

  it('pluriels : zero, one, other selon les règles de la langue', async () => {
    const message = { zero: 'Aucun client', one: '{n} client', other: '{n} clients' };
    enregistrerMessages('fr', { essai: { clients: message } });
    enregistrerMessages('en', { essai: { clients: { zero: 'No clients', one: '{n} client', other: '{n} clients' } } });
    expect(t('essai.clients', { n: 0 })).toBe('Aucun client');
    expect(t('essai.clients', { n: 1 })).toBe('1 client');
    expect(n(t('essai.clients', { n: 1500 }))).toBe('1 500 clients');
    await changerLangue('en');
    expect(t('essai.clients', { n: 2 })).toBe('2 clients');
    expect(t('essai.clients', { n: 1 })).toBe('1 client');
  });

  it('texte absent dans une langue : secours en français', async () => {
    enregistrerMessages('fr', { essai: { seulementFr: 'Uniquement en français' } });
    await changerLangue('de');
    expect(t('essai.seulementFr')).toBe('Uniquement en français');
    expect(t('commun.reessayer')).toBe('Erneut versuchen');
  });
});

describe('changerLangue', () => {
  it('charge la langue, prévient les abonnés, met à jour <html lang> et retient le choix', async () => {
    const rappel = vi.fn();
    const desabonner = abonner(rappel);
    const code = await changerLangue('ja', { retenir: true });
    expect(code).toBe('ja');
    expect(langueCourante()).toBe('ja');
    expect(t('commun.chargement')).toBe('読み込み中…');
    expect(document.documentElement.lang).toBe('ja');
    expect(localeIntl()).toBe('ja-JP');
    expect(rappel).toHaveBeenCalledWith('ja');
    expect(localStorage.getItem('cir.langue')).toBe('ja');
    desabonner();
    await changerLangue('en');
    expect(rappel).toHaveBeenCalledTimes(1);
  });

  it('chinois : <html lang="zh-Hans">, en-tête « zh-hans » pour Django', async () => {
    await changerLangue('zh-CN');
    expect(langueCourante()).toBe('zh');
    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(langueApi()).toBe('zh-hans');
  });

  it('langue non proposée : français', async () => {
    await changerLangue('en');
    expect(await changerLangue('es')).toBe('fr');
    expect(langueCourante()).toBe('fr');
  });

  it('retenir: false : le choix n’est pas gardé', async () => {
    await changerLangue('de', { retenir: false });
    expect(localStorage.getItem('cir.langue')).toBeNull();
  });
});

describe('detecterLangue', () => {
  it('ordre : ?lang=, puis choix retenu, puis navigateur, puis français', () => {
    expect(detecterLangue({ recherche: '?lang=ja', stockee: 'de', preferees: ['en-US'] })).toBe('ja');
    expect(detecterLangue({ recherche: '', stockee: 'de', preferees: ['en-US'] })).toBe('de');
    expect(detecterLangue({ recherche: '', stockee: null, preferees: ['es-ES', 'zh-CN', 'en'] })).toBe('zh');
    expect(detecterLangue({ recherche: '?lang=xx', stockee: null, preferees: ['pt-BR'] })).toBe('fr');
    expect(detecterLangue({ recherche: '', stockee: null, preferees: [] })).toBe('fr');
  });
});

describe('textes des autres modules communs dans la langue choisie', () => {
  it('mise en forme : FCFA, « prix sur devis », dates et étapes de commande', async () => {
    await changerLangue('en');
    expect(fcfa(12500)).toBe('12,500 FCFA');
    expect(prix(null)).toBe('Price on quotation');
    expect(prix(8000, 'pose')).toBe('8,000 FCFA / m², installation included');
    expect(dateHeure(new Date(2026, 9, 16, 14, 30))).toBe('16 October 2026 at 14:30');
    expect(STATUTS.contrat_signe.libelle).toBe('Contract signed');
    await changerLangue('de');
    expect(n(fcfa(12500))).toBe('12.500 FCFA');
    expect(prix('')).toBe('Preis auf Anfrage');
  });

  it('client API : Accept-Language suit la langue, messages d’erreur traduits', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) }));
    const api = creerClientApi({ baseUrl: 'http://api.test', fetch });
    await api.get('/api/sante/', { auth: false });
    expect(fetch.mock.calls[0][1].headers['Accept-Language']).toBe('fr');
    await changerLangue('zh');
    await api.get('/api/sante/', { auth: false });
    expect(fetch.mock.calls[1][1].headers['Accept-Language']).toBe('zh-hans');
    expect(new ErreurApi(0).message).toBe('无法连接服务器。请检查您的网络连接后重试。');
    expect(new ErreurApi(500, { detail: 'Traceback…' }).message).toBe('服务器出现问题，请稍后重试。');
  });
});

describe('fichiers de messages communs', () => {
  it.each([['en', en], ['zh', zh], ['de', de], ['ja', ja]])('%s : mêmes clés et variables que le français', (code, messages) => {
    expect(ecartsAvecFrancais(fr, messages)).toEqual([]);
  });

  it('le contrôle repère les oublis', () => {
    expect(ecartsAvecFrancais({ a: { b: 'x {n}', c: 'y' } }, { a: { b: 'x', d: 'z' } })).toEqual([
      'variables différentes : a.b', 'clé manquante : a.c', 'clé en trop : a.d',
    ]);
  });
});
