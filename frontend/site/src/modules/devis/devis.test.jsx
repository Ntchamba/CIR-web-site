// Devis : aperçu (lignes à la demande, expiré, impression) et demande de rendu (aperçu des photos, 5 au plus, 429).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { appels, emplacement, page, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

import ApercuDevis from './composants/ApercuDevis.jsx';

const RESUME = { id: 5, reference: 'DEV-2026-0005', commande: 7, commande_reference: 'CIR-2026-0007', etat: 'envoye', expire: false, total: '510000', valide_jusqu_au: '2026-11-15', envoye_le: '2026-10-16' };
const DETAIL = {
  ...RESUME, notes: 'Pose comprise.',
  lignes: [
    { ordre: 1, type_ligne: 'materiau', libelle: 'Résine YD-306', surface_m2: '42.50', dosage_kg_m2: '1.50', quantite_kg: '63.75', prix_kg: '6000', prix_m2: null, montant: '382500' },
    { ordre: 2, type_ligne: 'forfait', libelle: 'Main-d’œuvre', surface_m2: null, dosage_kg_m2: null, quantite_kg: null, prix_kg: null, prix_m2: null, montant: '127500' },
  ],
};

describe('ApercuDevis', () => {
  it('résumé visible, lignes chargées à la demande, impression disponible', async () => {
    const fetch = simulerApi(routesClient({ 'GET /api/devis/5/': reponse(200, DETAIL) }));
    render(<MemoryRouter><ApercuDevis resume={RESUME} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Devis DEV-2026-0005' })).toBeInTheDocument();
    expect(screen.getByText(/510\s000 FCFA/)).toBeInTheDocument();
    expect(screen.getByText('15 novembre 2026')).toBeInTheDocument();
    expect(appels(fetch, 'GET', '/api/devis/5/')).toHaveLength(0);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Voir le détail' }));
    const tableau = await screen.findByRole('table');
    expect(within(tableau).getByText('Résine YD-306')).toBeInTheDocument();
    expect(within(tableau).getByText(/63,75 kg/)).toBeInTheDocument();
    expect(within(tableau).getByText(/382\s500 FCFA/)).toBeInTheDocument();
    expect(screen.getByText('Pose comprise.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeInTheDocument();
  });

  it('devis expiré signalé', () => {
    render(<MemoryRouter><ApercuDevis resume={{ ...RESUME, expire: true }} /></MemoryRouter>);
    expect(screen.getByText('Expiré')).toBeInTheDocument();
  });

  it('impression : lance window.print puis retire les marques d’impression', async () => {
    simulerApi(routesClient({ 'GET /api/devis/5/': reponse(200, DETAIL) }));
    const print = vi.fn(() => { expect(document.body.dataset.impression).toBe('oui'); });
    vi.stubGlobal('print', print);
    window.print = print;
    render(<MemoryRouter><ApercuDevis resume={RESUME} /></MemoryRouter>);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Voir le détail' }));
    await u.click(await screen.findByRole('button', { name: /Imprimer/ }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.dataset.impression).toBeUndefined();
  });
});

const image = (nom) => new File(['x'], nom, { type: 'image/webp' });

describe('DemandeRenduPage', () => {
  const routes = (extra = {}) => routesClient({
    'GET /api/catalogue/produits/': reponse(200, page([{ id: 3, reference: 'YD-306', nom: 'Sable coloré', slug: 'yd' }])),
    'GET /api/commandes/': reponse(200, page([])),
    ...extra,
  });

  it('envoi multipart avec produit et photos, puis retour sur Mes demandes', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const fetch = simulerApi(routes({
      'POST /api/devis/demandes-rendu/': reponse(201, { id: 1, reference: 'REN-2026-0001' }),
      'GET /api/devis/demandes-rendu/': reponse(200, page([])),
      'GET /api/contact/demandes/miennes/': reponse(200, page([])),
    }));
    rendreApp('/devis/demande');
    const u = userEvent.setup();
    await screen.findByRole('option', { name: 'YD-306 · Sable coloré' });
    await u.type(screen.getByLabelText(/Décrivez votre projet/), 'Sol de garage à refaire en gris');
    await u.selectOptions(screen.getByLabelText(/Type de bâtiment/), 'maison');
    await u.selectOptions(screen.getByLabelText('Produit de référence (facultatif)'), '3');
    await u.upload(screen.getByLabelText('Choisir des photos'), [image('a.webp'), image('b.webp')]);
    const apercus = screen.getByRole('list', { name: 'Aperçu des photos' });
    expect(within(apercus).getAllByRole('img')).toHaveLength(2);
    await u.click(within(apercus).getByRole('button', { name: 'Retirer la photo b.webp' }));
    expect(within(apercus).getAllByRole('img')).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    await waitFor(() => expect(emplacement()).toBe('/mes-demandes'));
    const [[corps]] = appels(fetch, 'POST', '/api/devis/demandes-rendu/');
    expect(corps).toBeInstanceOf(FormData);
    expect(corps.get('description')).toBe('Sol de garage à refaire en gris');
    expect(corps.get('type_batiment')).toBe('maison');
    expect(corps.get('produit')).toBe('3');
    expect(corps.getAll('images')).toHaveLength(1);
    expect(await screen.findByText('Votre demande REN-2026-0001 a été envoyée.')).toBeInTheDocument();
  });

  it('6 photos : seules 5 sont gardées, avec un message', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    simulerApi(routes());
    rendreApp('/devis/demande');
    const u = userEvent.setup();
    await u.upload(await screen.findByLabelText('Choisir des photos'), Array.from({ length: 6 }, (_, i) => image(`p${i}.webp`)));
    expect(within(screen.getByRole('list', { name: 'Aperçu des photos' })).getAllByRole('img')).toHaveLength(5);
    expect(screen.getByText('Vous pouvez joindre 5 photos au plus.')).toBeInTheDocument();
  });

  it('description trop courte : refusée localement', async () => {
    const fetch = simulerApi(routes());
    rendreApp('/devis/demande');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Décrivez votre projet/), 'court');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByText('Décrivez votre projet en 20 caractères au moins.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/devis/demandes-rendu/')).toHaveLength(0);
  });

  it('429 : message traduit ; erreur d’image du serveur sous les photos', async () => {
    simulerApi(routes({ 'POST /api/devis/demandes-rendu/': reponse(429, { detail: 'throttled' }) }));
    rendreApp('/devis/demande');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Décrivez votre projet/), 'Sol de garage à refaire en gris');
    await u.selectOptions(screen.getByLabelText(/Type de bâtiment/), 'maison');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByText(/nombre de demandes autorisé pour aujourd/)).toBeInTheDocument();
  });

  it('403 compte de l’équipe : message du serveur affiché', async () => {
    simulerApi(routes({ 'POST /api/devis/demandes-rendu/': reponse(403, { detail: 'Réservé aux clients.', code: 'compte_equipe' }) }));
    rendreApp('/devis/demande');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Décrivez votre projet/), 'Sol de garage à refaire en gris');
    await u.selectOptions(screen.getByLabelText(/Type de bâtiment/), 'maison');
    await u.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    expect(await screen.findByText('Réservé aux clients.')).toBeInTheDocument();
  });
});
