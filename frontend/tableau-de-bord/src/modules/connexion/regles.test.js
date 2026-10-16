// Règles pures du module connexion : retour après connexion (?suite=), contrôles de saisie, rôles,
// et clé de stockage des jetons propre au tableau de bord.
import { api } from '@/app/api.js';

import { estEquipe, estSuperAdmin, libelleRole, OPTIONS_ROLES_EQUIPE, ROLES } from './roles.js';
import { cheminDeSuite } from './suite.js';
import { validerConnexion } from './validation.js';

const suite = (requete) => cheminDeSuite(new URLSearchParams(requete));

describe('cheminDeSuite (retour après connexion)', () => {
  it('accepte un chemin interne et garde sa requête', () => {
    expect(suite('suite=/clients')).toBe('/clients');
    expect(suite(`suite=${encodeURIComponent('/clients?q=paul&page=2')}`)).toBe('/clients?q=paul&page=2');
  });

  it("renvoie à l'accueil sans paramètre ou avec un paramètre vide", () => {
    expect(suite('')).toBe('/');
    expect(suite('suite=')).toBe('/');
    expect(cheminDeSuite(null)).toBe('/');
  });

  it('refuse les adresses absolues et les adresses « //domaine »', () => {
    expect(suite('suite=https://pirate.example')).toBe('/');
    expect(suite('suite=//pirate.example')).toBe('/');
    expect(suite('suite=javascript:alert(1)')).toBe('/');
    expect(suite(`suite=${encodeURIComponent('/\\pirate.example')}`)).toBe('/');
  });

  it('ne renvoie pas vers la page de connexion elle-même', () => {
    expect(suite('suite=/connexion')).toBe('/');
  });

  // Les navigateurs retirent tabulations et retours à la ligne d'une URL : « /\t/pirate.example »
  // devient « //pirate.example ». React Router, faute de pouvoir faire pushState vers une autre origine,
  // se rabat sur window.location.assign : c'est une redirection ouverte. Le site public (compte/suite.js)
  // rejette déjà ces caractères.
  it.each([
    ['tabulation', '/%09/pirate.example'],
    ['retour à la ligne', '/%0A/pirate.example'],
    ['retour chariot', '/%0D/pirate.example'],
    ['caractère nul', '/%00/pirate.example'],
    ['DEL', '/%7F/pirate.example'],
    ['barre oblique inverse après un caractère de contrôle', '/%09\\pirate.example'],
  ])('refuse un caractère de contrôle (%s) dans ?suite=', (_nom, valeur) => {
    expect(suite(`suite=${valeur}`)).toBe('/');
  });
});

describe('validerConnexion', () => {
  it('exige un e-mail valide et un mot de passe', () => {
    expect(validerConnexion({ email: '', mot_de_passe: '' })).toEqual({
      email: 'Indiquez votre e-mail.',
      mot_de_passe: 'Indiquez votre mot de passe.',
    });
    expect(validerConnexion({ email: 'pas-un-email', mot_de_passe: 'x' })).toEqual({
      email: "Cet e-mail n'est pas valide.",
    });
    expect(validerConnexion({ email: '  admin@cir.cm  ', mot_de_passe: 'x' })).toEqual({});
  });
});

describe('rôles', () => {
  it('reconnaît les membres et le super-administrateur, jamais un client', () => {
    expect(estEquipe({ role: ROLES.MEMBRE })).toBe(true);
    expect(estEquipe({ role: ROLES.SUPER_ADMIN })).toBe(true);
    expect(estEquipe({ role: ROLES.CLIENT })).toBe(false);
    expect(estEquipe({})).toBe(false);
    expect(estEquipe(null)).toBe(false);
  });

  it('suit le booléen est_equipe envoyé par le serveur', () => {
    expect(estEquipe({ role: ROLES.MEMBRE, est_equipe: false })).toBe(false);
    expect(estEquipe({ role: ROLES.CLIENT, est_equipe: false })).toBe(false);
  });

  it('distingue le super-administrateur', () => {
    expect(estSuperAdmin({ role: ROLES.SUPER_ADMIN })).toBe(true);
    expect(estSuperAdmin({ role: ROLES.MEMBRE })).toBe(false);
    expect(estSuperAdmin(null)).toBe(false);
  });

  it("ne propose que les rôles de l'équipe à l'ajout (valeurs du back-end)", () => {
    expect(OPTIONS_ROLES_EQUIPE.map(([v]) => v)).toEqual(['membre', 'super_admin']);
    expect(libelleRole('super_admin')).toBe('Super-administrateur');
    expect(libelleRole('inconnu')).toBe('inconnu');
    expect(libelleRole(undefined)).toBe('');
  });
});

describe('jetons du tableau de bord', () => {
  it('sont rangés sous « cir-tdb.jetons », jamais sous la clé du site public', () => {
    api.jetons.ecrire({ acces: 'a', rafraichissement: 'r' });
    expect(JSON.parse(localStorage.getItem('cir-tdb.jetons'))).toEqual({ acces: 'a', rafraichissement: 'r' });
    expect(localStorage.getItem('cir-site.jetons')).toBeNull();
    api.jetons.effacer();
    expect(localStorage.getItem('cir-tdb.jetons')).toBeNull();
  });

  it('ignorent les jetons du site public', () => {
    localStorage.setItem('cir-site.jetons', JSON.stringify({ acces: 'site', rafraichissement: 'site' }));
    expect(api.jetons.lire()).toBeNull();
  });
});
