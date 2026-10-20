// Compléments vague 4 (testeur) : sommes absentes quand les clés manquent (pas seulement null), aucune requête pour une
// période incomplète, accueil d'un membre simple sans aucune somme.
import { screen, waitFor } from '@testing-library/react';

import { appels, rendre, simulerApi } from '@/test/api-simulee.jsx';

const A_TRAITER = {
  commandes_nouvelles: 1, propositions_en_attente_equipe: 0, devis_a_envoyer: 0, demandes_rendu: 0, demandes_contact: 0,
  messages_non_lus: 0, appels_manques: 0, paiements_anomalies: 0,
};
const BASE = {
  periode: { du: '2026-09-21', au: '2026-10-20' },
  commandes: {
    total: 2, par_etape: { nouvelle: 1, signee: 0 }, par_type_batiment: { maison: 2 }, nouvelles: 1, signees: 1,
    taux_signature: null, delai_moyen_signature_jours: null,
  },
  a_traiter: A_TRAITER,
  top_produits: [],
};
// Ni `montants` ni `encaisse` : le serveur les omet pour un membre simple.
const EVOLUTION_SANS_ARGENT = { mois: [{ mois: '2026-09', commandes: 1, signees: 0 }, { mois: '2026-10', commandes: 2, signees: 1 }] };

describe('membre simple : clés d’argent absentes', () => {
  it('statistiques : ni carte d’argent ni graphique des encaissements, valeurs vides en tirets', async () => {
    simulerApi([
      ['GET', '/api/admin/statistiques/evolution/', EVOLUTION_SANS_ARGENT],
      ['GET', '/api/admin/statistiques/resume/', BASE],
    ]);
    rendre('/statistiques');
    await screen.findByText('Contrats signés', { selector: 'dt' });
    expect(screen.queryByText('Encaissé')).toBeNull();
    expect(screen.queryByText('Chiffre convenu')).toBeNull();
    expect(document.body.textContent).not.toMatch(/FCFA/);
    expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(1);
    expect(screen.getByText('Taux de signature').nextSibling).toHaveTextContent('—');
  });

  it('accueil : aucune somme', async () => {
    simulerApi([['GET', '/api/admin/statistiques/resume/', BASE]]);
    rendre('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aperçu des 30 derniers jours' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/FCFA/);
  });
});

describe('période incomplète', () => {
  it('dates libres sans « au » : message et aucune requête', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/statistiques/evolution/', EVOLUTION_SANS_ARGENT],
      ['GET', '/api/admin/statistiques/resume/', BASE],
    ]);
    rendre('/statistiques?p=libre&du=2026-10-01');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(appels(simule, 'GET', '/statistiques/evolution/')).toHaveLength(1));
    expect(appels(simule, 'GET', '/statistiques/resume/')).toHaveLength(0);
  });
});
