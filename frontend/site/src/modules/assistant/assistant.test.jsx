// Assistant IA du site public : API simulée (aucun appel réseau réel).
import { readFileSync } from 'node:fs';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, reponse, rendreApp, routesClient, simulerApi, simulerMouvementReduit } from '@/test/outils.jsx';

import { cheminInterne, liensSurs, texteEnvoyable } from './regles.js';
import { lireContexte } from './contexte.js';

const DISPO = reponse(200, { configure: true, ouvert: true });
const message = (id, texte, extra = {}) => ({
  id, role: 'assistant', texte, liens: [], bloque: false, cree_le: '2026-10-21T10:00:00Z', ...extra,
});
const CLE = '11111111-2222-3333-4444-555555555555';

function installer(routes = {}, { connecte = false } = {}) {
  const base = {
    'GET /api/assistant/disponibilite/': DISPO,
    'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
    'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
    'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
    ...routes,
  };
  return simulerApi(connecte ? routesClient(base) : base);
}

const bulle = () => screen.findByRole('button', { name: 'Assistant' });
async function ouvrir() {
  await userEvent.click(await bulle());
  return screen.findByRole('dialog', { name: 'Assistant CIR' });
}
const envoyerBouton = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Envoyer' });
const champ = () => screen.getByLabelText('Votre message');

describe('bulle', () => {
  it('masquée si l\'assistant n\'est pas configuré', async () => {
    const fetch = installer({ 'GET /api/assistant/disponibilite/': reponse(200, { configure: false, ouvert: false }) });
    rendreApp('/contact');
    await waitFor(() => expect(appels(fetch, 'GET', '/api/assistant/disponibilite/')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Assistant' })).toBeNull();
  });

  it('masquée si la disponibilité est injoignable (404 / réseau)', async () => {
    const fetch = installer({ 'GET /api/assistant/disponibilite/': reponse(503, {}) });
    rendreApp('/contact');
    await waitFor(() => expect(appels(fetch, 'GET', '/api/assistant/disponibilite/')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Assistant' })).toBeNull();
  });

  it('limite du jour atteinte : bouton désactivé avec explication, fenêtre jamais ouverte', async () => {
    installer({ 'GET /api/assistant/disponibilite/': reponse(200, { configure: true, ouvert: false }) });
    rendreApp('/contact');
    const b = await bulle();
    expect(b).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(b);
    expect(screen.getByText(/limite pour aujourd'hui/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disponible : n\'est demandée qu\'une fois la page affichée (aucun appel avant)', async () => {
    const fetch = installer();
    rendreApp('/contact');
    expect(appels(fetch, 'GET', '/api/assistant/disponibilite/')).toHaveLength(0);
    await bulle();
  });
});

describe('fenêtre', () => {
  it('dialogue modal avec bandeau permanent, suggestions génériques, focus dans le champ', async () => {
    installer();
    rendreApp('/contact');
    const dialogue = await ouvrir();
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(within(dialogue).getByText(/aucun prix ferme, l'équipe répond par devis/)).toBeInTheDocument();
    expect(within(dialogue).getByRole('log', { name: "Conversation avec l'assistant" })).toBeInTheDocument();
    expect(within(dialogue).getAllByRole('listitem').length).toBe(4);
    expect(champ()).toHaveFocus();
  });

  it('Tab et Maj+Tab restent dans la fenêtre ; Échap ferme et rend le focus à la bulle', async () => {
    installer();
    rendreApp('/contact');
    const dialogue = await ouvrir();
    const fermer = within(dialogue).getByRole('button', { name: "Fermer l'assistant" });
    // Maj+Tab depuis le premier élément focalisable (fermer) : on boucle sur le dernier.
    fermer.focus();
    await userEvent.tab({ shift: true });
    expect(dialogue).toContainElement(document.activeElement);
    expect(document.activeElement).not.toBe(fermer);
    // Tab depuis le dernier : retour au premier.
    await userEvent.tab();
    expect(fermer).toHaveFocus();
    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab();
      expect(dialogue).toContainElement(document.activeElement);
    }
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Assistant' })).toHaveFocus();
  });

  it('le bouton Fermer ferme et rend le focus à la bulle', async () => {
    installer();
    rendreApp('/contact');
    await ouvrir();
    await userEvent.click(screen.getByRole('button', { name: "Fermer l'assistant" }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Assistant' })).toHaveFocus();
  });

  it('cibles tactiles : le CSS impose 44 px aux boutons (variable --cible-tactile) et respecte prefers-reduced-motion', () => {
    const css = readFileSync('src/modules/assistant/Assistant.module.css', 'utf8');
    ['fermer', 'avisBouton', 'envoyer', 'suggestion', 'boutonBulle', 'lienBouton', 'lienTexte', 'champ'].forEach((classe) => {
      const bloc = css.match(new RegExp(`^\\.${classe} \\{[^}]*\\}`, 'm'))?.[0] ?? '';
      expect(bloc, classe).toMatch(/--cible-tactile/);
    });
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});

describe('envoi et affichage', () => {
  it('envoie le texte (Entrée), affiche la réponse, garde la clé, langue et contexte page', async () => {
    const fetch = installer({
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Bonjour !'), proposer_contact: false, restant: 5 }),
    });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'Bonjour{Enter}');
    expect(await screen.findByText('Bonjour !')).toBeInTheDocument();
    const [[corps]] = appels(fetch, 'POST', '/api/assistant/messages/');
    expect(corps).toEqual({ texte: 'Bonjour', langue: 'fr', contexte: { type: 'page' } });
    expect(JSON.parse(localStorage.getItem('cir-site.assistant'))).toEqual({ cle: CLE, connecte: false });
    expect(champ()).toHaveValue('');
    // Réponse annoncée poliment dans un journal.
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });

  it('Maj+Entrée fait un retour à la ligne sans envoyer ; compteur affiché', async () => {
    const fetch = installer();
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'a{Shift>}{Enter}{/Shift}b');
    expect(champ()).toHaveValue('a\nb');
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(0);
    expect(screen.getByText(/^3 \/ 1\D?000 caractères$/)).toBeInTheDocument();
    expect(champ()).toHaveAttribute('maxlength', '1000');
    expect(champ()).toHaveAttribute('lang', 'fr');
  });

  it('le texte de l\'assistant est affiché comme texte : HTML non interprété, adresse externe non cliquable', async () => {
    installer({
      'POST /api/assistant/messages/': reponse(200, {
        cle: CLE,
        message: message(9, 'Voir <a href="https://pirate.example">ici</a> <img src=x onerror="alert(1)"> https://pirate.example/x [lien](https://pirate.example)\nligne 2'),
        proposer_contact: false,
        restant: null,
      }),
    });
    const { container } = rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'test{Enter}');
    const texte = await screen.findByText(/Voir <a href=/);
    expect(texte.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(texte.textContent).toContain('https://pirate.example/x');
    expect(texte.textContent).toContain('\nligne 2');
    const dialogue = screen.getByRole('dialog');
    expect(dialogue.querySelector('img')).toBeNull();
    expect(within(dialogue).queryAllByRole('link')).toHaveLength(0);
    expect(container.querySelector('a[href*="pirate"]')).toBeNull();
  });

  it('seuls les liens du serveur sont cliquables (routeur interne) ; un lien externe du serveur est ignoré', async () => {
    installer({
      'POST /api/assistant/messages/': reponse(200, {
        cle: CLE,
        message: message(9, 'Voici la fiche.', {
          liens: [
            { libelle: 'Résine X', chemin: '/catalogue/resine-x' },
            { libelle: 'Pirate', chemin: 'https://pirate.example' },
            { libelle: 'Pirate 2', chemin: '//pirate.example' },
            { libelle: 'Script', chemin: 'javascript:alert(1)' },
          ],
        }),
        proposer_contact: false,
        restant: null,
      }),
    });
    rendreApp('/contact');
    const dialogue = await ouvrir();
    await userEvent.type(champ(), 'fiche{Enter}');
    const lien = await within(dialogue).findByRole('link', { name: 'Résine X' });
    expect(lien).toHaveAttribute('href', '/catalogue/resine-x');
    expect(within(dialogue).getAllByRole('link')).toHaveLength(1);
    await userEvent.click(lien);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('suggestion : envoie la question ; un double clic ne produit qu\'un seul envoi', async () => {
    let liberer;
    const fetch = installer({
      'POST /api/assistant/messages/': () => new Promise((resolve) => {
        liberer = () => resolve(reponse(200, { cle: CLE, message: message(9, 'Réponse'), proposer_contact: false, restant: null }));
      }),
    });
    rendreApp('/contact');
    await ouvrir();
    const bouton = screen.getByRole('button', { name: 'Comment demander un devis ?' });
    await userEvent.dblClick(bouton);
    await userEvent.type(champ(), 'autre{Enter}{Enter}');
    expect(screen.getByText("L'assistant écrit…")).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(1);
    act(() => liberer());
    expect(await screen.findByText('Réponse')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(1);
  });

  it('aucun envoi pour un texte vide', async () => {
    const fetch = installer();
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), '   {Enter}');
    expect(envoyerBouton()).toBeDisabled();
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(0);
  });
});

describe('erreurs', () => {
  it.each([
    [429, 'assistant_trop_de_messages', /Patientez un moment/],
    [503, 'assistant_limite_atteinte', /limite pour aujourd'hui\. Écrivez à l'équipe/],
    [503, 'assistant_indisponible', /momentanément indisponible\. Réessayez/],
  ])('%s %s : message traduit, texte conservé pour réessayer, aucun message affiché', async (statut, code, motif) => {
    const fetch = installer({ 'POST /api/assistant/messages/': reponse(statut, { detail: 'brut', code }) });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'ma question{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(motif);
    expect(screen.getByRole('alert')).not.toHaveTextContent('brut');
    expect(champ()).toHaveValue('ma question');
    expect(screen.queryByRole('article')).toBeNull();
    expect(localStorage.getItem('cir-site.assistant')).toBeNull();
    // Réessai possible.
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(1);
    await userEvent.click(envoyerBouton());
    await waitFor(() => expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(2));
  });

  it('assistant_non_configure : la bulle disparaît', async () => {
    installer({ 'POST /api/assistant/messages/': reponse(503, { code: 'assistant_non_configure' }) });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Assistant' })).toBeNull();
  });

  it('réseau coupé : message traduit', async () => {
    const fetch = installer();
    rendreApp('/contact');
    await ouvrir();
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.type(champ(), 'x{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Pas de connexion au serveur/);
    expect(champ()).toHaveValue('x');
  });
});

describe('conversation gardée', () => {
  const historique = {
    [`GET /api/assistant/conversations/${CLE}/`]: reponse(200, {
      cle: CLE,
      messages: [{ ...message(1, 'Question ancienne'), role: 'utilisateur' }, message(2, 'Réponse ancienne')],
    }),
  };

  it('la clé est reprise au rechargement : la conversation est rechargée à l\'ouverture, et la clé est envoyée', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    const fetch = installer({
      ...historique,
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(3, 'Suite'), proposer_contact: false, restant: null }),
    });
    rendreApp('/contact');
    await ouvrir();
    expect(await screen.findByText('Réponse ancienne')).toBeInTheDocument();
    expect(screen.getByText('Question ancienne')).toBeInTheDocument();
    expect(appels(fetch, 'GET', `/api/assistant/conversations/${CLE}/`)).toHaveLength(1);
    await userEvent.type(champ(), 'et ensuite{Enter}');
    await screen.findByText('Suite');
    expect(appels(fetch, 'POST', '/api/assistant/messages/')[0][0].cle).toBe(CLE);
    // Fermer puis rouvrir ne recharge pas.
    await userEvent.keyboard('{Escape}');
    await ouvrir();
    expect(appels(fetch, 'GET', `/api/assistant/conversations/${CLE}/`)).toHaveLength(1);
  });

  it('clé inconnue (404) : oubliée', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    installer({});
    rendreApp('/contact');
    await ouvrir();
    await waitFor(() => expect(localStorage.getItem('cir-site.assistant')).toBeNull());
    expect(screen.getByRole('button', { name: 'Comment demander un devis ?' })).toBeInTheDocument();
  });

  it('clé illisible dans le stockage : ignorée sans erreur', async () => {
    localStorage.setItem('cir-site.assistant', '{pas du json');
    installer({});
    rendreApp('/contact');
    await ouvrir();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stockage indisponible : l\'assistant fonctionne quand même', async () => {
    installer({
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(3, 'Ça marche'), proposer_contact: false, restant: null }),
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('plein'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('interdit'); });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    expect(await screen.findByText('Ça marche')).toBeInTheDocument();
  });

  it('effacer : confirmation, DELETE, fil vidé et clé oubliée', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    const fetch = installer({ ...historique, [`DELETE /api/assistant/conversations/${CLE}/`]: reponse(204, null) });
    rendreApp('/contact');
    await ouvrir();
    await screen.findByText('Réponse ancienne');
    await userEvent.click(screen.getByRole('button', { name: 'Effacer la conversation' }));
    expect(appels(fetch, 'DELETE', `/api/assistant/conversations/${CLE}/`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Non, garder' }));
    expect(screen.getByText('Réponse ancienne')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Effacer la conversation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oui, effacer' }));
    await waitFor(() => expect(screen.queryByText('Réponse ancienne')).toBeNull());
    expect(appels(fetch, 'DELETE', `/api/assistant/conversations/${CLE}/`)).toHaveLength(1);
    expect(localStorage.getItem('cir-site.assistant')).toBeNull();
  });

  it('une conversation de compte n\'est plus proposée une fois déconnecté (clé de compte rechargée sans session)', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: true }));
    const fetch = installer(historique);
    rendreApp('/contact');
    await ouvrir();
    await waitFor(() => expect(localStorage.getItem('cir-site.assistant')).toBeNull());
    expect(appels(fetch, 'GET', `/api/assistant/conversations/${CLE}/`)).toHaveLength(0);
  });
});

describe('avis et équipe', () => {
  it('avis 👍 : envoyé une fois, remerciement ensuite', async () => {
    const fetch = installer({
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Réponse'), proposer_contact: false, restant: null }),
      'POST /api/assistant/messages/9/avis/': reponse(204, null),
    });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    await screen.findByText('Réponse');
    await userEvent.click(screen.getByRole('button', { name: 'Réponse utile' }));
    expect(await screen.findByText('Merci pour votre avis.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/assistant/messages/9/avis/')[0][0]).toEqual({ utile: true });
    expect(screen.queryByRole('button', { name: 'Réponse peu utile' })).toBeNull();
  });

  it('avis : la clé de conversation est envoyée (corps et en-tête) ; 409 avis_deja_donne = remerciement sans erreur', async () => {
    const fetch = installer({
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Réponse'), proposer_contact: false, restant: null }),
      'POST /api/assistant/messages/9/avis/': reponse(409, { code: 'avis_deja_donne' }),
    });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    await screen.findByText('Réponse');
    await userEvent.click(screen.getByRole('button', { name: 'Réponse utile' }));
    expect(await screen.findByText('Merci pour votre avis.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const [[corps, init]] = appels(fetch, 'POST', '/api/assistant/messages/9/avis/');
    expect(corps).toEqual({ utile: true, cle: CLE });
    expect(init.headers['X-Assistant-Cle']).toBe(CLE);
  });

  it('avis refusé par le serveur : message d\'erreur, avis de nouveau possible', async () => {
    installer({
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Réponse'), proposer_contact: false, restant: null }),
      'POST /api/assistant/messages/9/avis/': reponse(500, {}),
    });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    await screen.findByText('Réponse');
    await userEvent.click(screen.getByRole('button', { name: 'Réponse peu utile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/avis n'a pas pu être enregistré/);
    expect(screen.getByRole('button', { name: 'Réponse peu utile' })).toBeInTheDocument();
  });

  it('proposer_contact : visiteur → /contact et devis ; connecté → /messages', async () => {
    const rep = { 'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Voyez l\'équipe'), proposer_contact: true, restant: null }) };
    installer(rep);
    const { unmount } = rendreApp('/catalogue');
    await ouvrir();
    await userEvent.type(champ(), 'prix ?{Enter}');
    expect(await screen.findByRole('link', { name: "Écrire à l'équipe" })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Demander un devis' })).toHaveAttribute('href', '/devis/demande');
    unmount();

    installer(rep, { connecte: true });
    rendreApp('/catalogue');
    await ouvrir();
    await userEvent.type(champ(), 'prix ?{Enter}');
    expect(await screen.findByRole('link', { name: "Écrire à l'équipe" })).toHaveAttribute('href', '/messages');
    expect(localStorage.getItem('cir-site.assistant')).toContain('"connecte":true');
  });

  it('pas de boutons vers l\'équipe quand le serveur ne les propose pas', async () => {
    installer({ 'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Ok'), proposer_contact: false, restant: null }) });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'x{Enter}');
    await screen.findByText('Ok');
    expect(screen.queryByRole('link', { name: "Écrire à l'équipe" })).toBeNull();
  });
});

describe('contexte de page', () => {
  it('fiche produit : la référence est envoyée', async () => {
    const produit = {
      slug: 'resine-x', reference: 'RES-001', nom: 'Résine X', accroche: 'Solide', images: [], usages: [], designs: [],
      prix: null, famille: { slug: 'f', nom: 'F' },
    };
    const fetch = installer({
      'GET /api/catalogue/produits/resine-x/': reponse(200, produit),
      'POST /api/assistant/messages/': reponse(200, { cle: CLE, message: message(9, 'Ok'), proposer_contact: false, restant: null }),
    });
    rendreApp('/catalogue/resine-x');
    await screen.findByRole('heading', { name: 'Résine X' });
    await ouvrir();
    await userEvent.type(champ(), 'cette résine ?{Enter}');
    await screen.findByText('Ok');
    expect(appels(fetch, 'POST', '/api/assistant/messages/')[0][0].contexte).toEqual({ type: 'produit', reference: 'RES-001' });
  });
});

describe('règles pures', () => {
  it('texteEnvoyable : vide, espaces et trop long refusés', () => {
    expect(texteEnvoyable('  ')).toBe('');
    expect(texteEnvoyable(' a ')).toBe('a');
    expect(texteEnvoyable('a'.repeat(1001))).toBe('');
    expect(texteEnvoyable(null)).toBe('');
  });

  it('cheminInterne / liensSurs : seuls les chemins du site passent', () => {
    expect(cheminInterne('/catalogue/x?y=1')).toBe('/catalogue/x?y=1');
    ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil', '/a b', '', null, 'catalogue'].forEach((c) => expect(cheminInterne(c)).toBeNull());
    expect(liensSurs([{ libelle: 'A', chemin: '/a' }, { libelle: '', chemin: '/b' }, { libelle: 'C', chemin: 'http://c' }, null])).toEqual([{ libelle: 'A', chemin: '/a' }]);
    expect(liensSurs('x')).toEqual([]);
  });

  it('contexte par défaut : la page', () => {
    expect(lireContexte()).toEqual({ type: 'page' });
  });
});

describe('revue testeur : avis déjà donné, clé périmée, modalité', () => {
  const historiqueAvis = (messages) => ({
    [`GET /api/assistant/conversations/${CLE}/`]: reponse(200, { cle: CLE, messages }),
  });

  it('historique : l\'avis n\'est pas reproposé si utile n\'est pas null ; proposé si null ou absent', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    installer(historiqueAvis([
      message(1, 'Déjà utile', { utile: true }),
      message(2, 'Déjà inutile', { utile: false }),
      message(3, 'Sans avis', { utile: null }),
      message(4, 'Ancien serveur'),
    ]));
    rendreApp('/contact');
    await ouvrir();
    await screen.findByText('Ancien serveur');
    expect(screen.getAllByText('Merci pour votre avis.')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Réponse utile' })).toHaveLength(2);
  });

  it('clé périmée à l\'envoi (404) : un seul rejeu sans clé, pas de boucle', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    let n = 0;
    const fetch = installer({
      ...historiqueAvis([message(1, 'Ancienne')]),
      'POST /api/assistant/messages/': (corps) => {
        n += 1;
        return corps.cle ? reponse(404, { detail: 'Introuvable.' }) : reponse(200, { cle: 'nouvelle', message: message(7, 'Neuf'), proposer_contact: false, restant: null });
      },
    });
    rendreApp('/contact');
    await ouvrir();
    await screen.findByText('Ancienne');
    await userEvent.type(champ(), 'salut{Enter}');
    await screen.findByText('Neuf');
    expect(n).toBe(2);
    expect(appels(fetch, 'POST', '/api/assistant/messages/')[1][0].cle).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('cir-site.assistant')).cle).toBe('nouvelle');
  });

  it('404 persistant même sans clé : une seule requête de rejeu, erreur traduite, texte conservé', async () => {
    localStorage.setItem('cir-site.assistant', JSON.stringify({ cle: CLE, connecte: false }));
    const fetch = installer({ ...historiqueAvis([]), 'POST /api/assistant/messages/': reponse(404, {}) });
    rendreApp('/contact');
    await ouvrir();
    await userEvent.type(champ(), 'salut{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/assistant/messages/')).toHaveLength(2);
    expect(champ()).toHaveValue('salut');
  });

  it('modalité : le voile intercepte les clics (pas de pointer-events: none) et un clic dessus ferme', async () => {
    const css = readFileSync('src/modules/assistant/Assistant.module.css', 'utf8');
    expect(css.match(/^\.voile \{[^}]*\}/m)[0]).not.toMatch(/pointer-events:\s*none/);
    installer();
    rendreApp('/contact');
    const dialogue = await ouvrir();
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    await userEvent.click(dialogue);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(dialogue.parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('aucun dangerouslySetInnerHTML ni innerHTML dans le module', () => {
    ['composants/FilAssistant.jsx', 'composants/FenetreAssistant.jsx', 'composants/Saisie.jsx', 'BulleAssistant.jsx', 'useAssistant.js']
      .forEach((f) => expect(readFileSync(`src/modules/assistant/${f}`, 'utf8')).not.toMatch(/dangerouslySetInnerHTML|innerHTML/));
  });
});

describe('autres langues', () => {
  it('le chinois traduit le dialogue', async () => {
    simulerMouvementReduit(true);
    installer();
    rendreApp('/contact');
    await userEvent.selectOptions(within(screen.getByRole('banner')).getByRole('combobox'), 'zh');
    await userEvent.click(await screen.findByRole('button', { name: '智能助手' }));
    expect(await screen.findByRole('dialog', { name: 'CIR 智能助手' })).toBeInTheDocument();
    expect(screen.getByText(/回答仅供参考/)).toBeInTheDocument();
  });
});
