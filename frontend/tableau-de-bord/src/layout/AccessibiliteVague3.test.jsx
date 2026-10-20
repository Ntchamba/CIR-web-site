// Accessibilité de la vague 3 : cibles tactiles de 44 px, mouvement réduit, libellés, focus, annonces.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { installerDirect } from '@/test/direct-simule.js';
import { page, rendre, simulerApi } from '@/test/api-simulee.jsx';

const css = (chemin) => readFileSync(resolve(__dirname, '../..', chemin), 'utf8');
const regle = (feuille, classe) => new RegExp(`\\.${classe}\\s*{[^}]*(?:min-)?(?:height|width):\\s*var\\(--cible-tactile\\)`).test(feuille);

describe('cibles tactiles (CSS)', () => {
  it('messagerie : conversation, retour, retrait de fichier', () => {
    const f = css('src/modules/messagerie/Messagerie.module.css');
    ['conversation', 'retour', 'retrait', 'lienPiece'].forEach((c) => expect(regle(f, c), c).toBe(true));
  });
  it('notifications : cloche, éléments, lien « tout marquer »', () => {
    const f = css('src/modules/notifications/Notifications.module.css');
    ['cloche', 'element', 'lienBouton', 'toutVoir'].forEach((c) => expect(regle(f, c), c).toBe(true));
  });
  it("l'animation de la bannière d'appel est désactivée avec prefers-reduced-motion", () => {
    const f = css('src/modules/appels/Appels.module.css');
    expect(f).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*{[^}]*animation/);
  });
});

describe('libellés et annonces', () => {
  it('le fil est un journal annoncé poliment, la saisie a un libellé, les boutons ont un nom', async () => {
    installerDirect();
    const conversation = { id: 5, client: { id: 7, nom_complet: 'Awa Nana', email: 'a@x.cm', telephone: '', langue: 'fr' }, non_lus: 0, dernier_message: null };
    simulerApi([
      ['GET', /conversations\/5\/messages\//, { results: [], a_plus: false }],
      ['GET', '/api/admin/messagerie/conversations/', page([conversation])],
    ]);
    rendre('/messagerie');
    await userEvent.setup().click(await screen.findByRole('button', { name: /Awa Nana/ }));
    const journal = await screen.findByRole('log', { name: 'Messages de la conversation' });
    expect(journal).toHaveAttribute('aria-live', 'polite');
    expect(journal).toHaveAttribute('tabindex', '0'); // défilable au clavier
    expect(screen.getByLabelText('Votre message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Joindre un fichier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conversations/ })).toBeInTheDocument(); // retour (masqué sur grand écran par le CSS)
  });

  it("la bannière d'appel entrant est annoncée tout de suite aux lecteurs d'écran", async () => {
    const direct = installerDirect();
    simulerApi([]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    direct.recevoir({
      type: 'appel_entrant',
      appel: { id: 1, reference: 'APP-1', type: 'audio', etat: 'sonne', client: { id: 2, nom_complet: 'Paul Eto', telephone: '' }, commande: null },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Appel entrant de Paul Eto');
  });
});
