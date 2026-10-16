// Tests de la mise en forme : FCFA, « Prix sur devis », surfaces, dates en français.
import { STATUTS, UNITES, date, dateHeure, depuis, fcfa, prix, surface } from './format.js';

// Intl insère des espaces insécables (U+202F, U+00A0) : on les ramène à des espaces simples.
const n = (texte) => texte.replace(/[  ]/g, ' ');

describe('fcfa', () => {
  it('formate les montants à la française, sans décimales', () => {
    expect(n(fcfa(12500))).toBe('12 500 FCFA');
    expect(n(fcfa('1500000'))).toBe('1 500 000 FCFA');
    expect(n(fcfa(0))).toBe('0 FCFA');
    expect(n(fcfa(99.6))).toBe('100 FCFA');
  });

  it('« — » si la valeur est absente ou non numérique', () => {
    [null, undefined, '', 'abc', NaN].forEach((v) => expect(fcfa(v)).toBe('—'));
  });
});

describe('prix', () => {
  it('« Prix sur devis » si le prix est absent : jamais de prix inventé', () => {
    [null, undefined, '', 'n/a'].forEach((v) => expect(prix(v, 'm2')).toBe('Prix sur devis'));
  });

  it('montant avec son unité, « FCFA » par défaut', () => {
    expect(n(prix(12500, 'm2'))).toBe('12 500 FCFA / m²');
    expect(n(prix('8000', 'kg'))).toBe('8 000 FCFA / kg');
    expect(n(prix(15000, 'pose'))).toBe('15 000 FCFA / m², pose comprise');
    expect(n(prix(15000))).toBe('15 000 FCFA');
    expect(n(prix(15000, 'inconnue'))).toBe('15 000 FCFA');
    expect(n(prix(0, 'm2'))).toBe('0 FCFA / m²');
  });

  it('expose les unités', () => {
    expect(Object.keys(UNITES)).toEqual(['m2', 'kg', 'pose']);
  });
});

describe('surface', () => {
  it('« 42,5 m² » ; « — » si vide ou nulle', () => {
    expect(n(surface(42.5))).toBe('42,5 m²');
    expect(n(surface('1200'))).toBe('1 200 m²');
    expect(n(surface(3.456))).toBe('3,46 m²');
    expect(surface(0)).toBe('—');
    expect(surface(null)).toBe('—');
    expect(surface('')).toBe('—');
  });
});

describe('dates', () => {
  const d = new Date(2026, 9, 16, 14, 30); // 16 octobre 2026, 14:30 (heure locale)

  it('date : « 16 octobre 2026 », chaîne ISO acceptée, vide si invalide', () => {
    expect(date(d)).toBe('16 octobre 2026');
    expect(date('2026-03-12T10:00:00')).toBe('12 mars 2026');
    expect(date(d, { month: 'long' })).toBe('octobre');
    expect(date(null)).toBe('');
    expect(date('pas une date')).toBe('');
  });

  it('dateHeure : « 16 octobre 2026 à 14:30 »', () => {
    expect(dateHeure(d)).toBe('16 octobre 2026 à 14:30');
    expect(dateHeure('')).toBe('');
  });

  it('depuis : durées relatives puis date courte', () => {
    const maintenant = d.getTime();
    const avant = (secondes) => new Date(maintenant - secondes * 1000);
    expect(depuis(avant(10), maintenant)).toBe("à l'instant");
    expect(depuis(avant(5 * 60), maintenant)).toBe('il y a 5 min');
    expect(depuis(avant(3 * 3600), maintenant)).toBe('il y a 3 h');
    expect(depuis(avant(30 * 3600), maintenant)).toBe('hier');
    expect(depuis(avant(4 * 86400), maintenant)).toBe('il y a 4 j');
    expect(depuis(new Date(2026, 2, 12), maintenant)).toBe('12 mars');
    expect(depuis(undefined, maintenant)).toBe('');
  });
});

describe('STATUTS', () => {
  it('reprend les étapes métier dans l’ordre, avec « Annulée »', () => {
    expect(Object.values(STATUTS).map((s) => s.libelle)).toEqual([
      'Nouvelle', 'En négociation', 'Contrat signé', 'Travaux en cours', 'Terminée', 'Annulée',
    ]);
  });
});
