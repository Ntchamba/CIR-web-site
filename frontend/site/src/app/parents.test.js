import { estRacine, parentDe, RACINES } from './parents.js';

describe('parents (flèche de retour)', () => {
  it('cinq pages racines sans flèche', () => {
    expect(RACINES).toEqual(['/', '/catalogue', '/realisations', '/commandes', '/compte']);
    RACINES.forEach((r) => expect(estRacine(r)).toBe(true));
    expect(estRacine('/commandes/')).toBe(true);
    expect(estRacine('/catalogue/yd-500')).toBe(false);
  });

  it.each([
    ['/catalogue/yd-500', '/catalogue'],
    ['/commandes/12', '/commandes'],
    ['/commandes/12/payer', '/commandes/12'],
    ['/commandes/nouvelle', '/commandes'],
    ['/paiements/5/recu', '/commandes'],
    ['/actualites/une-news', '/actualites'],
    ['/actualites', '/'],
    ['/selection', '/catalogue'],
    ['/inscription', '/connexion'],
    ['/connexion', '/'],
    ['/contact', '/'],
    ['/page-inconnue', '/'],
  ])('%s a pour parent %s', (chemin, parent) => {
    expect(parentDe(chemin)).toBe(parent);
  });

  it('un parent est toujours une adresse du site (commence par un seul /)', () => {
    ['/messages', '/notifications', '/devis/demande', '/mes-demandes', '//evil.com'].forEach((c) => {
      expect(parentDe(c)).toMatch(/^\/(?!\/)/);
    });
  });
});
