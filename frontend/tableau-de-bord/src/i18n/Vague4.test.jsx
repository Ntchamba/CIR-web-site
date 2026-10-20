// Multilingue de la vague 4 (paiements, statistiques) : tous les codes ont un libellé dans les cinq langues, les
// pluriels et variables se résolvent, et les pages passent dans la langue choisie sans texte en dur.
import { screen } from '@testing-library/react';

import { page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { changerLangue, t } from './index.js';

const CODES = {
  'paiements.etats': ['en_attente', 'reussi', 'echoue', 'expire', 'annule', 'anomalie'],
  'paiements.modes': ['mobile', 'lien', 'manuel'],
  'paiements.modesManuels': ['especes', 'virement', 'cheque', 'autre'],
  'paiements.statuts': ['non_applicable', 'non_paye', 'partiel', 'paye'],
  'statistiques.aTraiter': [
    'commandes_nouvelles', 'propositions_en_attente_equipe', 'devis_a_envoyer', 'demandes_rendu', 'demandes_contact',
    'messages_non_lus', 'appels_manques', 'paiements_anomalies',
  ],
  'statistiques.erreursPeriode': ['incomplete', 'invalide', 'ordre', 'longue'],
  'notifications.evenements': ['paiement_recu', 'paiement_recu_equipe', 'paiement_echoue', 'paiement_anomalie'],
};
const LANGUES = ['fr', 'en', 'zh', 'de', 'ja'];

describe.each(LANGUES)('libellés de la vague 4 en %s', (langue) => {
  it('chaque code a un libellé (pas la clé brute)', async () => {
    await changerLangue(langue);
    Object.entries(CODES).forEach(([prefixe, codes]) => {
      codes.forEach((code) => {
        const cle = `${prefixe}.${code}`;
        expect(t(cle), cle).toBeTruthy();
        expect(t(cle), cle).not.toBe(cle);
      });
    });
  });

  it('les pluriels et variables sont résolus', async () => {
    await changerLangue(langue);
    [
      ['paiements.nombre', { n: 3 }], ['paiements.filtreCommande', { id: 7 }], ['paiements.tiroir.titre', { reference: 'PAY-1' }],
      ['paiements.reglement.depasse', { reste: '1' }], ['paiements.reglement.question', { montant: '1', mode: 'x' }],
      ['paiements.reglement.annonce', { montant: '1' }], ['paiements.reglement.resteAPayer', { reste: '1' }],
      ['statistiques.periode.intervalle', { du: 'a', au: 'b' }], ['statistiques.cartes.nouvelles', { n: 2 }],
      ['statistiques.cartes.nombrePaiements', { n: 1 }], ['statistiques.top.commandes', { n: 1 }],
      ['statistiques.joursValeur', { valeur: '3,5' }], ['statistiques.graphique.tableau', { titre: 'x' }],
    ].forEach(([cle, variables]) => {
      const texte = t(cle, variables);
      expect(texte, cle).not.toMatch(/\{\w+\}/);
      expect(texte, cle).not.toBe(cle);
    });
  });
});

describe('pages de la vague 4 dans une autre langue', () => {
  it('Paiements en allemand : titre, colonnes et libellés d’état traduits localement', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', { en_attente: 0, anomalies: 0, encaisse_mois: null }],
      ['GET', '/api/admin/paiements/', page([{
        id: 1, reference: 'PAY-2026-0001', commande: { id: 7, reference: 'CIR-2026-0007' }, client: { id: 3, nom_complet: 'Awa' },
        montant: 1000, mode: 'manuel', etat: 'reussi', cree_le: '2026-10-19T09:00:00Z',
      }])],
    ]);
    await changerLangue('de');
    rendre('/paiements');
    expect(await screen.findByRole('heading', { level: 1, name: 'Zahlungen' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Zahlungsart' })).toBeInTheDocument();
    expect(screen.getByText('Erfolgreich', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Offline', { selector: 'td' })).toBeInTheDocument();
  });

  it('Statistiques en japonais : titre, périodes et état vide', async () => {
    simulerApi([
      ['GET', '/api/admin/statistiques/evolution/', { mois: [] }],
      ['GET', '/api/admin/statistiques/resume/', {
        periode: { du: '2026-09-21', au: '2026-10-20' },
        commandes: { total: 0, par_etape: {}, par_type_batiment: {}, nouvelles: 0, signees: 0, taux_signature: null, delai_moyen_signature_jours: null },
        a_traiter: {}, montants: null, top_produits: [],
      }],
    ]);
    await changerLangue('ja');
    rendre('/statistiques');
    expect(await screen.findByRole('heading', { level: 1, name: '統計' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 日間' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'この期間の注文はありません' })).toBeInTheDocument();
  });
});
