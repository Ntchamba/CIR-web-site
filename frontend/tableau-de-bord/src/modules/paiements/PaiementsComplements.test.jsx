// Compléments vague 4 (testeur) : bouton « Revérifier » selon l'état, sommes absentes quand le serveur ne les envoie pas
// (clé absente, pas seulement null), montant de règlement nul ou décimal, et pastille Paiements sur trame.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';
import { installerDirect } from '@/test/direct-simule.js';

const BASE = {
  id: 5, reference: 'PAY-2026-0005', commande: { id: 7, reference: 'CIR-2026-0007' }, client: { id: 3, nom_complet: 'Awa Nana' },
  montant: 150000, devise: 'XAF', mode: 'mobile', etat: 'en_attente', etat_libelle: 'Libellé', operateur: 'MTN',
  telephone_masque: '+237 6** ** ** 22', telephone: '+237699001122', raison: '', raison_libelle: '',
  reference_campay: 'cp-1', reference_operateur: '', saisi_par: null, mode_manuel: '', note: '',
  derniere_verification_le: null, cree_le: '2026-10-19T09:00:00Z', termine_le: null,
};

describe('bouton « Revérifier » selon l’état', () => {
  it.each([
    ['en_attente', true], ['expire', true], ['anomalie', true],
    ['reussi', false], ['echoue', false], ['annule', false],
  ])('état %s : bouton présent = %s, et jamais le numéro complet', async (etat, present) => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', { en_attente: 0, anomalies: 0 }],
      ['GET', '/api/admin/paiements/', page([{ ...BASE, etat }])],
    ]);
    rendre('/paiements');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'PAY-2026-0005' }));
    const volet = await screen.findByRole('dialog');
    const bouton = within(volet).queryByRole('button', { name: /Revérifier/ });
    expect(Boolean(bouton)).toBe(present);
    expect(volet.textContent).not.toMatch(/699001122/);
    expect(document.body.textContent).not.toMatch(/699001122/);
  });
});

describe('résumé des paiements sans `encaisse_mois`', () => {
  it('la carte « encaissé du mois » est absente quand la clé manque, présente à 0 seulement si le serveur envoie 0', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/resume/', { en_attente: 1, anomalies: 0 }],
      ['GET', '/api/admin/paiements/', page([BASE])],
    ]);
    rendre('/paiements');
    await screen.findByRole('button', { name: 'PAY-2026-0005' });
    expect(screen.queryByText(/Encaissé/)).toBeNull();
    expect(screen.queryByText(/(^|\s)0 FCFA/)).toBeNull();
    expect(screen.queryByText(/Encaissé/)).toBeNull();
  });
});

describe('règlement hors ligne : montants refusés côté client', () => {
  const DETAIL = {
    id: 7, reference: 'CIR-2026-0007', type_batiment: 'maison', etat: 'contrat_signe', surface_m2: '42.50', nombre_lignes: 1,
    montant_convenu: 400000, montant_paye: 150000, reste_a_payer: 250000, statut_paiement: 'partiel', action_requise: false,
    modifie_le: '2026-10-17T10:00:00Z', cree_le: '2026-10-16T10:00:00Z',
    client: { id: 3, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '+237 677 00 11 22', ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Rue 1', langue: 'fr' },
    adresse: { ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Face pharmacie' },
    description: '', lignes: [], propositions: [], historique: [], contrat: null, devis: [], notes_internes: '', actions_possibles: [],
  };

  it.each(['0', '1500.5', '-100', '1e3', 'abc'])('refuse « %s » sans rien envoyer', async (saisie) => {
    const simule = simulerApi([
      ['GET', '/api/admin/paiements/', page([])],
      ['GET', '/api/admin/commandes/7/', DETAIL],
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Enregistrer un règlement hors ligne' }));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), saisie);
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await screen.findByText('Saisissez un montant entier en FCFA, supérieur à zéro.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Confirmation du règlement' })).toBeNull();
    expect(appels(simule, 'POST', '/reglements/')).toHaveLength(0);
  });

  it('accepte exactement le reste à payer', async () => {
    simulerApi([
      ['GET', '/api/admin/paiements/', page([])],
      ['GET', '/api/admin/commandes/7/', DETAIL],
    ]);
    rendre('/commandes/7');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Enregistrer un règlement hors ligne' }));
    await u.type(screen.getByLabelText(/^Montant \(FCFA\)/), '250000');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le règlement' }));
    expect(await screen.findByRole('group', { name: 'Confirmation du règlement' })).toBeInTheDocument();
  });
});

describe('pastille Paiements sans `en_attente`', () => {
  it('ne compte que ce que le serveur envoie, et se recale sur la trame', async () => {
    const direct = installerDirect();
    let resume = { anomalies: 2 };
    simulerApi([['GET', '/api/admin/paiements/resume/', () => resume]]);
    rendre('/');
    const nav = await screen.findByRole('navigation', { name: 'Menu du tableau de bord' });
    expect(await within(nav).findByRole('link', { name: /^Paiements\s+2 à traiter$/u })).toBeInTheDocument();
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    resume = { anomalies: 0, en_attente: 0 };
    direct.recevoir({ type: 'paiement_mis_a_jour', paiement: { id: 5, etat: 'reussi', commande: { id: 7 } } });
    await waitFor(() => expect(within(nav).getByRole('link', { name: 'Paiements' })).toBeInTheDocument());
  });
});
