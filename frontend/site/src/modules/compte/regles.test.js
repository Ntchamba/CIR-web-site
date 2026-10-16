// Tests des règles du module compte : validation, adresse obligatoire, redirection limitée au site.
import { adresseComplete, extraireAdresse, initialesDe, prenomDe, validerAdresse } from './adresse.js';
import { cheminDeSuite } from './suite.js';
import { validerConnexion, validerInscription, validerProfil } from './validation.js';

const INSCRIPTION_OK = {
  nom_complet: 'Awa Ngono',
  email: 'awa@exemple.cm',
  telephone: '',
  mot_de_passe: 'motdepasse1',
  ville: 'Douala',
  quartier: 'Bonapriso',
  rue_ou_repere: 'Près de la pharmacie',
};

describe('validerConnexion', () => {
  it('accepte un e-mail et un mot de passe', () => {
    expect(validerConnexion({ email: ' awa@exemple.cm ', mot_de_passe: 'x' })).toEqual({});
  });

  it('refuse un e-mail vide ou invalide et un mot de passe vide', () => {
    expect(validerConnexion({ email: '', mot_de_passe: '' })).toEqual({
      email: 'Indiquez votre adresse e-mail.',
      mot_de_passe: 'Indiquez votre mot de passe.',
    });
    expect(validerConnexion({ email: 'awa@exemple', mot_de_passe: 'x' }).email).toMatch(/pas valide/);
    expect(validerConnexion({ email: 'a b@c.cm', mot_de_passe: 'x' }).email).toMatch(/pas valide/);
  });
});

describe('validerInscription', () => {
  it('accepte un formulaire complet (téléphone facultatif)', () => {
    expect(validerInscription(INSCRIPTION_OK)).toEqual({});
    expect(validerInscription({ ...INSCRIPTION_OK, telephone: '+237 6 99 81 16 35' })).toEqual({});
  });

  it('exige l’adresse complète : ville, quartier, rue ou repère (espaces seuls refusés)', () => {
    const erreurs = validerInscription({ ...INSCRIPTION_OK, ville: '', quartier: '   ', rue_ou_repere: '' });
    expect(Object.keys(erreurs).sort()).toEqual(['quartier', 'rue_ou_repere', 'ville']);
  });

  it('nom, e-mail, téléphone trop court, mot de passe', () => {
    expect(validerInscription({ ...INSCRIPTION_OK, nom_complet: ' ' }).nom_complet).toBeTruthy();
    expect(validerInscription({ ...INSCRIPTION_OK, email: 'faux' }).email).toBeTruthy();
    expect(validerInscription({ ...INSCRIPTION_OK, telephone: '699' }).telephone).toMatch(/incomplet/);
    expect(validerInscription({ ...INSCRIPTION_OK, mot_de_passe: '' }).mot_de_passe).toBe('Choisissez un mot de passe.');
    expect(validerInscription({ ...INSCRIPTION_OK, mot_de_passe: 'court1' }).mot_de_passe).toMatch(/8 caractères/);
    expect(validerInscription({ ...INSCRIPTION_OK, mot_de_passe: '12345678' }).mot_de_passe).toMatch(/que des chiffres/);
  });
});

describe('validerProfil', () => {
  it('nom et adresse obligatoires, téléphone plausible', () => {
    expect(validerProfil({ nom_complet: 'Awa', telephone: '', ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Rue 1' })).toEqual({});
    expect(validerProfil({ nom_complet: '', telephone: '12', ville: '', quartier: '', rue_ou_repere: '' })).toEqual({
      nom_complet: 'Indiquez votre nom complet.',
      telephone: 'Ce numéro de téléphone semble incomplet.',
      ville: 'Indiquez votre ville.',
      quartier: 'Indiquez votre quartier.',
      rue_ou_repere: 'Indiquez une rue ou un repère connu.',
    });
  });
});

describe('adresse', () => {
  it('adresseComplete : le booléen du serveur fait foi', () => {
    expect(adresseComplete({ adresse_complete: false, ville: 'D', quartier: 'Q', rue_ou_repere: 'R' })).toBe(false);
    expect(adresseComplete({ adresse_complete: true })).toBe(true);
  });

  it('adresseComplete : sinon les trois champs non vides', () => {
    expect(adresseComplete({ ville: 'D', quartier: 'Q', rue_ou_repere: 'R' })).toBe(true);
    expect(adresseComplete({ ville: 'D', quartier: ' ', rue_ou_repere: 'R' })).toBe(false);
    expect(adresseComplete(null)).toBe(false);
  });

  it('validerAdresse, extraireAdresse', () => {
    expect(validerAdresse({ ville: 'D', quartier: 'Q', rue_ou_repere: 'R' })).toEqual({});
    expect(Object.keys(validerAdresse(undefined))).toHaveLength(3);
    expect(extraireAdresse({ ville: 'D', quartier: null, autre: 1 })).toEqual({ ville: 'D', quartier: '', rue_ou_repere: '' });
  });

  it('prenomDe et initialesDe', () => {
    expect(prenomDe({ nom_complet: '  Awa  Ngono ' })).toBe('Awa');
    expect(prenomDe(null)).toBe('');
    expect(initialesDe({ nom_complet: 'awa ngono mballa' })).toBe('AN');
    expect(initialesDe({ nom_complet: '' })).toBe('?');
  });
});

describe('cheminDeSuite (redirection après connexion limitée au site)', () => {
  const suite = (valeur) => cheminDeSuite(new URLSearchParams(valeur === undefined ? '' : { suite: valeur }));

  it('chemin par défaut : /compte', () => {
    expect(suite(undefined)).toBe('/compte');
    expect(suite('')).toBe('/compte');
    expect(cheminDeSuite(new URLSearchParams(''), '/accueil')).toBe('/accueil');
  });

  it('accepte les chemins internes', () => {
    expect(suite('/commandes')).toBe('/commandes');
    expect(suite('/catalogue?type=industrie#haut')).toBe('/catalogue?type=industrie#haut');
  });

  it('refuse les adresses externes et les schémas', () => {
    [
      'https://pirate.example',
      'http://pirate.example/compte',
      '//pirate.example',
      '/\\pirate.example',
      'javascript:alert(1)',
      'pirate.example',
      ' /compte',
    ].forEach((v) => expect(suite(v), v).toBe('/compte'));
  });

  it('refuse les caractères de contrôle que le navigateur supprime (« /\\t/pirate » devient « //pirate »)', () => {
    ['/\t/pirate.example', '/\n/pirate.example', '/\r/pirate.example'].forEach((v) => {
      expect(suite(v), JSON.stringify(v)).toBe('/compte');
    });
  });
});
