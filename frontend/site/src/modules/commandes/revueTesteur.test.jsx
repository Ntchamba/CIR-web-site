// Tests ajoutés par le testeur (vague 2) : motif d'annulation, focus des confirmations, 403 compte de l'équipe,
// texte libre inerte, changement de langue, protection des routes, code mort.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { changerLangue } from '@/i18n/index.js';
import { appels, emplacement, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

import { COMMANDE, COMMANDE_SIGNEE, PROPOSITION_EQUIPE } from './fixtures.js';

const CHEMIN = '/api/commandes/7/';
const ouvrir = (detail = COMMANDE, extra = {}) => {
  const fetch = simulerApi(routesClient({ [`GET ${CHEMIN}`]: reponse(200, detail), ...extra }));
  rendreApp('/commandes/7');
  return fetch;
};
const titre = () => screen.findByRole('heading', { level: 1, name: 'CIR-2026-0007' });

describe('revue testeur : motif d’annulation (contrat : historique[].motif)', () => {
  it('le motif saisi à l’annulation est affiché dans l’historique de la commande annulée', async () => {
    const annulee = {
      ...COMMANDE, etat: 'annulee', actions_possibles: [], action_requise: false,
      propositions: [{ ...PROPOSITION_EQUIPE, etat: 'remplacee', peut_repondre: false }],
      historique: [
        ...COMMANDE.historique,
        { de: 'negociation', vers: 'annulee', par: 'client', motif: 'Projet reporté à l’an prochain', cree_le: '2026-10-17T10:00:00Z' },
      ],
    };
    ouvrir(annulee);
    await titre();
    const u = userEvent.setup();
    await u.click(screen.getByText("Historique des changements d'étape"));
    expect(screen.getByText(/Projet reporté à l’an prochain/)).toBeInTheDocument();
  });
});

describe('revue testeur : focus et confirmations', () => {
  it('accepter : le focus passe sur la confirmation à l’ouverture', async () => {
    ouvrir();
    await titre();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accepter' }));
    const confirmation = screen.getByRole('group', { name: /accept/i });
    expect(confirmation).toHaveFocus();
  });

  it('refuser : confirmation d’abord, aucun appel avant confirmation', async () => {
    const fetch = ouvrir();
    await titre();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refuser' }));
    expect(screen.getByRole('group', { name: /refus/i })).toHaveFocus();
    expect(appels(fetch, 'POST', `${CHEMIN}propositions/11/refuser/`)).toHaveLength(0);
  });

  it('annuler : le focus passe sur la confirmation', async () => {
    ouvrir();
    await titre();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Annuler la commande' }));
    expect(screen.getByRole('group', { name: 'Annuler cette commande ?' })).toHaveFocus();
  });
});

describe('revue testeur : texte libre et contrat', () => {
  it('message de proposition et description : affichés comme du texte, jamais interprétés', async () => {
    const html = '<img src=x onerror="alert(1)"><b>gras</b>';
    ouvrir({
      ...COMMANDE, description: html,
      propositions: [{ ...PROPOSITION_EQUIPE, message: html }],
    });
    await titre();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
    expect(screen.getAllByText(html).length).toBeGreaterThanOrEqual(2);
  });

  it('contrat : adresse en objet (format du contrat d’API) rendue en une ligne', async () => {
    const signee = {
      ...COMMANDE_SIGNEE,
      contrat: { ...COMMANDE_SIGNEE.contrat, adresse: { ville: 'Douala', quartier: 'Akwa', rue_ou_repere: 'Rue des Palmiers' } },
    };
    ouvrir(signee);
    await titre();
    expect(screen.getByText('Rue des Palmiers, Akwa, Douala')).toBeInTheDocument();
  });

  it('commande signée : aucun bouton de négociation ni d’annulation sans actions_possibles', async () => {
    ouvrir(COMMANDE_SIGNEE);
    await titre();
    ['Accepter', 'Refuser', 'Annuler la commande'].forEach((nom) => {
      expect(screen.queryByRole('button', { name: nom })).toBeNull();
    });
    expect(screen.queryByRole('button', { name: /proposition/i })).toBeNull();
  });
});

describe('revue testeur : protection et langue', () => {
  it.each(['/commandes/7', '/commandes/nouvelle', '/selection', '/mes-demandes', '/devis/demande'])(
    'visiteur sur %s : renvoyé vers la connexion avec ?suite=',
    async (chemin) => {
      simulerApi();
      rendreApp(chemin);
      await waitFor(() => expect(emplacement()).toContain('/connexion'));
      expect(decodeURIComponent(emplacement())).toContain(`suite=${chemin}`);
    },
  );

  it('changement de langue : la commande est redemandée et les libellés suivent', async () => {
    const fetch = ouvrir();
    await titre();
    const avant = appels(fetch, 'GET', CHEMIN).length;
    await act(async () => { await changerLangue('en'); });
    await waitFor(() => expect(appels(fetch, 'GET', CHEMIN).length).toBeGreaterThan(avant));
    const derniere = fetch.mock.calls.filter(([u]) => new URL(u).pathname === CHEMIN).at(-1)[1];
    expect(JSON.stringify(derniere.headers)).toMatch(/en/);
    expect(await screen.findByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(document.body).queryByRole('button', { name: 'Accepter' })).toBeNull();
  });
});

describe('revue testeur : hygiène du code', () => {
  const lister = (dossier) => readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? lister(chemin) : [chemin];
  });
  const racine = join(process.cwd(), 'src');

  it('aucun composant ou page de la vague 2 n’utilise dangerouslySetInnerHTML', () => {
    const fautifs = ['modules/commandes', 'modules/devis', 'modules/contact', 'modules/selection']
      .flatMap((d) => lister(join(racine, d)))
      .filter((f) => f.endsWith('.jsx') && !f.endsWith('.test.jsx'))
      .filter((f) => /dangerouslySetInnerHTML|innerHTML/.test(readFileSync(f, 'utf8')));
    expect(fautifs).toEqual([]);
  });

  it('code mort : BientotDisponible n’est plus importé nulle part', () => {
    const importeurs = lister(racine)
      .filter((f) => /\.(jsx?|css)$/.test(f) && !f.endsWith('BientotDisponible.jsx') && !f.endsWith('revueTesteur.test.jsx'))
      .filter((f) => /BientotDisponible/.test(readFileSync(f, 'utf8')));
    expect(importeurs).toEqual([]);
  });
});
