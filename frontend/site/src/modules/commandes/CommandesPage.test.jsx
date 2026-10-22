// Liste des commandes : étapes, réponse attendue, filtre par étape, état vide, accès protégé.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { emplacement, page, parametresDes, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

import { RESUME_COMMANDE } from './fixtures.js';

describe('CommandesPage', () => {
  it('visiteur : renvoyé vers la connexion avec retour sur /commandes', async () => {
    simulerApi();
    rendreApp('/commandes');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument());
  });

  it('liste : référence, étape, montant convenu seulement s’il existe, réponse attendue', async () => {
    simulerApi(routesClient({
      'GET /api/commandes/': reponse(200, page([
        RESUME_COMMANDE,
        { ...RESUME_COMMANDE, id: 8, reference: 'CIR-2026-0008', etat: 'contrat_signe', montant_convenu: '510000', action_requise: false, nombre_lignes: 2 },
      ])),
    }));
    rendreApp('/commandes');
    const liste = await screen.findByRole('list', { name: 'Mes commandes' });
    const cartes = within(liste).getAllByRole('listitem');
    expect(cartes).toHaveLength(2);
    expect(within(cartes[0]).getByRole('link', { name: /Commande CIR-2026-0007/ })).toHaveAttribute('href', '/commandes/7');
    expect(within(cartes[0]).getByText('En négociation')).toBeInTheDocument();
    expect(within(cartes[0]).getByText('Une réponse est attendue de votre part')).toBeInTheDocument();
    expect(within(cartes[0]).queryByText(/Montant convenu/)).toBeNull();
        expect(within(cartes[1]).getByText(/2 produits/)).toBeInTheDocument();
    expect(within(cartes[1]).queryByText('Une réponse est attendue de votre part')).toBeNull();
  });

  it('filtre par étape : envoie ?etat= et garde l’adresse partageable', async () => {
    const fetch = simulerApi(routesClient({ 'GET /api/commandes/': reponse(200, page([RESUME_COMMANDE])) }));
    rendreApp('/commandes');
    await screen.findByRole('list', { name: 'Mes commandes' });
    await userEvent.selectOptions(screen.getByLabelText(/étape/i), 'travaux');
    await waitFor(() => expect(emplacement()).toBe('/commandes?etat=travaux'));
    await waitFor(() => expect(parametresDes(fetch, '/api/commandes/').at(-1).get('etat')).toBe('travaux'));
    expect(screen.getByLabelText(/étape/i)).toHaveValue('travaux');
  });

  it('aucune commande : état vide avec lien vers le catalogue', async () => {
    simulerApi(routesClient({ 'GET /api/commandes/': reponse(200, page([])) }));
    rendreApp('/commandes');
    expect(await screen.findByRole('heading', { name: "Vous n'avez pas encore de commande" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le catalogue' })).toHaveAttribute('href', '/catalogue');
  });

  it('erreur serveur : message et bouton Réessayer', async () => {
    simulerApi(routesClient({ 'GET /api/commandes/': reponse(500, {}) }));
    rendreApp('/commandes');
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
