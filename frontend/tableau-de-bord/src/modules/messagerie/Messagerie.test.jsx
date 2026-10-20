// Messagerie (équipe) : liste, fil, envoi optimiste par WebSocket ou HTTP, pièces jointes, lu, écrit…, historique,
// rattrapage, nouvelle conversation. API et WebSocket simulés.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const CLIENT = { id: 7, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '699 11 22 33', langue: 'en' };
const CONVERSATION = {
  id: 5, client: CLIENT, non_lus: 2, dernier_message_le: '2026-10-20T08:30:00Z',
  dernier_message: { texte: 'Bonjour, je voudrais un devis.', auteur_role: 'client', cree_le: '2026-10-20T08:30:00Z' },
};
const message = (id, role, texte, extra = {}) => ({
  id, conversation: 5, auteur_role: role, auteur_nom: role === 'client' ? 'Awa Nana' : 'Jean Mbarga', texte,
  commande: null, pieces_jointes: [], cree_le: `2026-10-20T08:${10 + id}:00Z`, lu_le: null, cle_client: '', ...extra,
});
const MESSAGES = [message(1, 'client', 'Bonjour, je voudrais un devis.'), message(2, 'equipe', 'Bonjour Awa, avec plaisir.')];

const routes = (extra = [], messages = { results: MESSAGES, a_plus: false }) => [
  ...extra,
  ['GET', /conversations\/5\/messages\//, messages],
  ['POST', /conversations\/5\/lu\//, { non_lus: 0 }],
  ['GET', '/api/admin/messagerie/conversations/', page([CONVERSATION])],
  ['GET', '/api/admin/commandes/?client=7', page([{ id: 12, reference: 'CIR-2026-0012' }])],
];

async function ouvrirConversation() {
  const u = userEvent.setup();
  await u.click(await screen.findByRole('button', { name: /Awa Nana/ }));
  await screen.findByText('Bonjour Awa, avec plaisir.');
  return u;
}

const zoneTexte = () => screen.getByLabelText('Votre message');

describe('MessageriePage', { timeout: 15000 }, () => {
  it('liste les conversations avec aperçu et pastille de non lus', async () => {
    installerDirect();
    simulerApi(routes());
    rendre('/messagerie');
    const bouton = await screen.findByRole('button', { name: /Awa Nana/ });
    expect(within(bouton).getByText('Bonjour, je voudrais un devis.')).toBeInTheDocument();
    expect(within(bouton).getByText('2 messages non lus')).toBeInTheDocument();
    expect(screen.getByText('Choisissez une conversation dans la liste ou démarrez-en une nouvelle.')).toBeInTheDocument();
  });

  it('ouvre le fil, affiche le contexte du client et marque les messages lus', async () => {
    installerDirect();
    const simule = simulerApi(routes());
    rendre('/messagerie');
    await ouvrirConversation();
    const contexte = screen.getByRole('region', { name: 'Conversation avec Awa Nana' });
    expect(within(contexte).getByRole('link', { name: '699 11 22 33' })).toHaveAttribute('href', 'tel:699112233');
    expect(within(contexte).getByRole('link', { name: 'awa@x.cm' })).toHaveAttribute('href', 'mailto:awa@x.cm');
    expect(within(contexte).getByRole('link', { name: 'Fiche client' })).toHaveAttribute('href', '/clients/7');
    expect(within(contexte).getByRole('link', { name: 'Commandes du client' })).toHaveAttribute('href', '/commandes?client=7');
    expect(within(contexte).getByText('Langue : English')).toBeInTheDocument();
    await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/lu/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', 'conversations/5/lu/')[0][1].body)).toEqual({ jusqu_a: 1 });
    // La pastille de la conversation est remise à zéro.
    await waitFor(() => expect(screen.queryByText('2 messages non lus')).not.toBeInTheDocument());
  });

  it("ne marque les messages lus que lorsque l'onglet est visible", async () => {
    installerDirect();
    const etat = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const simule = simulerApi(routes());
    rendre('/messagerie');
    await ouvrirConversation();
    expect(appels(simule, 'POST', 'conversations/5/lu/')).toHaveLength(0);
    etat.mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/lu/')).toHaveLength(1));
  });

  it("n'interprète jamais le texte d'un message comme du HTML", async () => {
    installerDirect();
    const piege = '<img src=x onerror="alert(1)"><b>gras</b>';
    simulerApi(routes([], { results: [message(1, 'client', piege)], a_plus: false }));
    const { container } = rendre('/messagerie');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Awa Nana/ }));
    expect(await screen.findByText(piege)).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it("envoie par le WebSocket (Entrée) avec un message optimiste confirmé par la trame du serveur", async () => {
    const direct = installerDirect();
    const simule = simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    const u = await ouvrirConversation();
    await u.type(zoneTexte(), 'Merci, un devis arrive.{Enter}');
    expect(zoneTexte()).toHaveValue('');
    expect(screen.getByText('Merci, un devis arrive.')).toBeInTheDocument();
    expect(screen.getByText(/Envoi…/)).toBeInTheDocument();
    const trame = direct.envoyees().find((x) => x.type === 'envoyer');
    expect(trame).toMatchObject({ type: 'envoyer', texte: 'Merci, un devis arrive.', conversation: 5 });
    expect(trame.cle_client).toBeTruthy();
    expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(0);
    // Confirmation : même cle_client → le message n'apparaît qu'une fois et n'est plus « en cours d'envoi ».
    direct.recevoir({ type: 'message', message: message(3, 'equipe', 'Merci, un devis arrive.', { cle_client: trame.cle_client }) });
    await waitFor(() => expect(screen.queryByText(/Envoi…/)).not.toBeInTheDocument());
    expect(within(screen.getByRole('log')).getAllByText('Merci, un devis arrive.')).toHaveLength(1);
  });

  it("Maj+Entrée va à la ligne sans envoyer, et l'envoi vide est impossible", async () => {
    const direct = installerDirect();
    simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    const u = await ouvrirConversation();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
    await u.type(zoneTexte(), 'ligne un{Shift>}{Enter}{/Shift}ligne deux');
    expect(zoneTexte()).toHaveValue('ligne un\nligne deux');
    expect(direct.envoyees().filter((x) => x.type === 'envoyer')).toHaveLength(0);
  });

  it("envoie par HTTP quand le direct n'est pas connecté, avec une clé anti-doublon", async () => {
    installerDirect();
    const simule = simulerApi(routes([
      ['POST', /conversations\/5\/messages\//, (url, options) => {
        const corps = JSON.parse(options.body);
        return reponse(201, message(9, 'equipe', corps.texte, { cle_client: corps.cle_client }));
      }],
    ]));
    rendre('/messagerie');
    const u = await ouvrirConversation();
    await u.type(zoneTexte(), 'Par HTTP');
    await u.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(1));
    const corps = JSON.parse(appels(simule, 'POST', 'conversations/5/messages/')[0][1].body);
    expect(corps).toMatchObject({ texte: 'Par HTTP' });
    expect(corps.cle_client).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Envoi…/)).not.toBeInTheDocument());
    expect(screen.getAllByText('Par HTTP')).toHaveLength(1);
  });

  it("signale l'échec d'un envoi et permet de réessayer", async () => {
    installerDirect();
    let tentatives = 0;
    const simule = simulerApi(routes([
      ['POST', /conversations\/5\/messages\//, (url, options) => {
        tentatives += 1;
        if (tentatives === 1) return reponse(429, { detail: 'Trop de messages.', code: 'trop_de_messages' });
        const corps = JSON.parse(options.body);
        return reponse(201, message(9, 'equipe', corps.texte, { cle_client: corps.cle_client }));
      }],
    ]));
    rendre('/messagerie');
    const u = await ouvrirConversation();
    await u.type(zoneTexte(), 'Premier essai{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("Échec de l'envoi. Trop de messages.");
    await u.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument());
    const [premier, second] = appels(simule, 'POST', 'conversations/5/messages/').map(([, o]) => JSON.parse(o.body));
    expect(second.cle_client).toBe(premier.cle_client);
    expect(screen.getAllByText('Premier essai')).toHaveLength(1);
  });

  it('reçoit les messages du client en direct, affiche « écrit… » et « Lu »', async () => {
    const direct = installerDirect();
    simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    await ouvrirConversation();
    direct.recevoir({ type: 'ecrit', conversation: 5, par: 'client' });
    expect(await screen.findByText('Le client écrit…')).toBeInTheDocument();
    direct.recevoir({ type: 'message', message: message(3, 'client', 'Une précision : 40 m².') });
    expect(await screen.findByText('Une précision : 40 m².')).toBeInTheDocument();
    expect(screen.queryByText('Le client écrit…')).not.toBeInTheDocument();
    expect(screen.queryByText('Lu')).not.toBeInTheDocument();
    direct.recevoir({ type: 'lu', conversation: 5, par: 'client', jusqu_a: 2 });
    expect(await screen.findByText('Lu')).toBeInTheDocument();
  });

  it("ignore les messages d'une autre conversation dans le fil ouvert, mais met la liste à jour", async () => {
    const direct = installerDirect();
    simulerApi(routes());
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    await ouvrirConversation();
    direct.recevoir({ type: 'message', message: { ...message(30, 'client', 'Autre fil'), conversation: 99 } });
    expect(screen.queryByText('Autre fil')).not.toBeInTheDocument();
  });

  it("charge l'historique en remontant avec « avant »", async () => {
    installerDirect();
    const simule = simulerApi(routes([
      ['GET', /messages\/\?avant=1/, { results: [message(0, 'client', 'Tout premier message')], a_plus: false }],
    ], { results: MESSAGES, a_plus: true }));
    rendre('/messagerie');
    const u = await ouvrirConversation();
    await u.click(screen.getByRole('button', { name: 'Messages précédents' }));
    expect(await screen.findByText('Tout premier message')).toBeInTheDocument();
    expect(simule.mock.calls.some(([x]) => /avant=1/.test(String(x)))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Messages précédents' })).not.toBeInTheDocument();
  });

  it('rattrape les messages manqués après une coupure avec « apres »', async () => {
    const direct = installerDirect();
    const simule = simulerApi(routes([
      ['POST', '/api/comptes/connexion/rafraichir/', { acces: 'renouvele' }],
      ['GET', /messages\/\?apres=2/, { results: [message(3, 'client', 'Écrit pendant la coupure')], a_plus: false }],
    ]));
    rendre('/messagerie');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter();
    await ouvrirConversation();
    direct.couper();
    expect(await screen.findByText(/La connexion en direct est interrompue/)).toBeInTheDocument();
    // Reconnexion : nouvelle instance après le délai de 1 s.
    await waitFor(() => expect(direct.instances.length).toBeGreaterThan(1), { timeout: 4000 });
    direct.connecter();
    expect(await screen.findByText('Écrit pendant la coupure')).toBeInTheDocument();
    expect(screen.queryByText(/La connexion en direct est interrompue/)).not.toBeInTheDocument();
    expect(simule.mock.calls.some(([x]) => /apres=2/.test(String(x)))).toBe(true);
  });

  it('refuse les types et les tailles interdits avant tout envoi, et limite à 3 pièces jointes', async () => {
    installerDirect();
    const simule = simulerApi(routes());
    rendre('/messagerie');
    await ouvrirConversation();
    const u = userEvent.setup({ applyAccept: false }); // le contrôle des types est celui de l'application
    const choix = screen.getByTestId('choix-fichier');
    await u.upload(choix, [new File(['<html>'], 'page.html', { type: 'text/html' })]);
    expect(await screen.findByRole('alert')).toHaveTextContent('« page.html » : type de fichier non accepté');
    const gros = new File(['x'], 'gros.pdf', { type: 'application/pdf' });
    Object.defineProperty(gros, 'size', { value: 11 * 1024 * 1024 });
    await u.upload(choix, [gros]);
    expect(await screen.findByRole('alert')).toHaveTextContent('« gros.pdf » dépasse 10 Mo.');
    const images = ['a', 'b', 'c', 'd'].map((n) => new File(['img'], `${n}.png`, { type: 'image/png' }));
    await u.upload(choix, images);
    expect(await screen.findByRole('alert')).toHaveTextContent('3 pièces jointes au plus par message.');
    expect(screen.getByText(/a\.png/)).toBeInTheDocument();
    expect(screen.queryByText(/d\.png/)).not.toBeInTheDocument();
    expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: 'Retirer a.png' }));
    expect(screen.queryByText(/a\.png/)).not.toBeInTheDocument();
  });

  it('envoie les pièces jointes par HTTP (multipart) avec la commande « à propos de »', async () => {
    installerDirect();
    const simule = simulerApi(routes([
      ['POST', /conversations\/5\/messages\//, (url, options) => {
        const f = options.body;
        return reponse(201, message(9, 'equipe', f.get('texte') || '', {
          cle_client: f.get('cle_client'), commande: { id: 12, reference: 'CIR-2026-0012' },
          pieces_jointes: [{ id: 3, nom_original: 'plan.pdf', type: 'document', taille: 2048, url: '/api/messagerie/pieces-jointes/3/' }],
        }));
      }],
    ]));
    rendre('/messagerie');
    const u = await ouvrirConversation();
    await u.selectOptions(await screen.findByLabelText('À propos de la commande'), 'CIR-2026-0012');
    await u.upload(screen.getByTestId('choix-fichier'), [new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' })]);
    await u.type(zoneTexte(), 'Voici le plan');
    await u.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => expect(appels(simule, 'POST', 'conversations/5/messages/')).toHaveLength(1));
    const formulaire = appels(simule, 'POST', 'conversations/5/messages/')[0][1].body;
    expect(formulaire).toBeInstanceOf(FormData);
    expect(formulaire.get('texte')).toBe('Voici le plan');
    expect(formulaire.get('commande')).toBe('12');
    expect(formulaire.getAll('fichiers')).toHaveLength(1);
    expect(await screen.findByText('À propos de CIR-2026-0012')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Télécharger plan.pdf (2 Ko)' })).toBeInTheDocument();
  });

  it("ouvre la conversation d'un client choisi dans « Nouvelle conversation »", async () => {
    installerDirect();
    const simule = simulerApi(routes([
      ['POST', '/api/admin/messagerie/conversations/', { id: 8, client: { id: 21, nom_complet: 'Paul Eto', email: 'p@x.cm', telephone: '', langue: 'fr' }, non_lus: 0, dernier_message: null }],
      ['GET', '/api/admin/comptes/clients/', page([{ id: 21, email: 'p@x.cm', nom_complet: 'Paul Eto' }])],
    ]));
    rendre('/messagerie');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nouvelle conversation' }));
    await u.click(await screen.findByRole('button', { name: 'Écrire à Paul Eto' }));
    await waitFor(() => expect(appels(simule, 'POST', '/api/admin/messagerie/conversations/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/api/admin/messagerie/conversations/')[0][1].body)).toEqual({ client: 21 });
    expect(await screen.findByRole('heading', { level: 2, name: 'Paul Eto' })).toBeInTheDocument();
  });

  it("ouvre la conversation d'un client depuis ?client= (lien « Écrire » des appels)", async () => {
    installerDirect();
    const simule = simulerApi(routes([
      ['POST', '/api/admin/messagerie/conversations/', CONVERSATION],
    ]));
    rendre('/messagerie?client=7');
    expect(await screen.findByText('Bonjour Awa, avec plaisir.')).toBeInTheDocument();
    expect(JSON.parse(appels(simule, 'POST', '/api/admin/messagerie/conversations/')[0][1].body)).toEqual({ client: 7 });
  });

  it('filtre par non lus et par recherche auprès du serveur', async () => {
    installerDirect();
    const simule = simulerApi(routes());
    rendre('/messagerie');
    const u = userEvent.setup();
    await screen.findByRole('button', { name: /Awa Nana/ });
    await u.click(screen.getByRole('checkbox', { name: 'Non lus seulement' }));
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /conversations\/\?non_lus=1/.test(String(x)))).toBe(true));
    await u.type(screen.getByLabelText('Rechercher un client'), 'awa');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /search=awa/.test(String(x)))).toBe(true));
  });
});
