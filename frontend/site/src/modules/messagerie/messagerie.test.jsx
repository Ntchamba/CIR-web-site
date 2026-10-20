// Messagerie du client (BF-11) : API et WebSocket simulés.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  appels, page, parametresDes, reponse, rendreApp, routesClient, simulerApi, simulerDirect, unMessage,
} from '@/test/outils.jsx';

const ROUTES_BASE = {
  'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 0 }),
  'GET /api/notifications/non-lues/': reponse(200, { count: 0 }),
  'GET /api/commandes/': reponse(200, page([])),
  'GET /api/appels/disponibilite/': reponse(200, { configure: false, equipe_en_ligne: false }),
};

function installer(routes = {}, { messages = [], aPlus = false } = {}) {
  const fetch = simulerApi(routesClient({
    ...ROUTES_BASE,
    'GET /api/messagerie/messages/': reponse(200, { results: messages, a_plus: aPlus }),
    ...routes,
  }));
  return fetch;
}

const saisie = () => screen.getByLabelText('Votre message');

async function ouvrirMessagerie() {
  const direct = simulerDirect();
  rendreApp('/messages');
  await screen.findByRole('heading', { level: 1, name: 'Messagerie' });
  await direct.attendreConnexion();
  direct.connecter();
  return direct;
}

describe('MessageriePage', () => {
  it('affiche le fil du plus ancien au plus récent, groupé par jour, avec « Lu » sous les messages lus', async () => {
    const hier = new Date(Date.now() - 86_400_000).toISOString();
    installer({}, {
      messages: [
        unMessage(1, { cree_le: hier, texte: 'Bonjour, je veux un devis' , auteur_role: 'client', auteur_nom: 'Awa', lu_le: hier }),
        unMessage(2, { texte: "Bonjour, c'est noté", lu_le: new Date().toISOString() }),
      ],
    });
    await ouvrirMessagerie();
    const fil = await screen.findByRole('log', { name: "Conversation avec l'équipe" });
    expect(await within(fil).findByText('Bonjour, je veux un devis')).toBeInTheDocument();
    expect(within(fil).getByText('Hier')).toBeInTheDocument();
    expect(within(fil).getByText("Aujourd'hui")).toBeInTheDocument();
    const textes = within(fil).getAllByText(/Bonjour/).map((n) => n.textContent);
    expect(textes).toEqual(['Bonjour, je veux un devis', "Bonjour, c'est noté"]);
    expect(within(fil).getByText(/Lu$/)).toBeInTheDocument();
  });

  it('le texte des messages est affiché tel quel (jamais interprété comme du HTML)', async () => {
    installer({}, { messages: [unMessage(1, { texte: '<b>gras</b> <img src=x onerror=alert(1)>' })] });
    await ouvrirMessagerie();
    expect(await screen.findByText('<b>gras</b> <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('log b, [role="log"] b')).toBeNull();
  });

  it('état vide quand il n’y a aucun message', async () => {
    installer();
    await ouvrirMessagerie();
    expect(await screen.findByText(/Aucun message pour l'instant/)).toBeInTheDocument();
  });

  it('envoi optimiste par le WebSocket : le message apparaît aussitôt, passe à « Envoyé » à la confirmation', async () => {
    const fetch = installer();
    const direct = await ouvrirMessagerie();
    await userEvent.type(saisie(), 'Bonjour{Enter}');
    expect(await screen.findByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText(/Envoi…/)).toBeInTheDocument();
    const envoyee = direct.envoyees().find((t) => t.type === 'envoyer');
    expect(envoyee).toMatchObject({ type: 'envoyer', texte: 'Bonjour' });
    expect(envoyee.cle_client).toBeTruthy();
    expect(saisie()).toHaveValue('');
    expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(0);

    direct.recevoir({ type: 'message', message: unMessage(10, { auteur_role: 'client', texte: 'Bonjour', cle_client: envoyee.cle_client }) });
    expect(await screen.findByText(/Envoyé/)).toBeInTheDocument();
    expect(screen.queryByText(/Envoi…/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Bonjour')).toHaveLength(1); // pas de doublon
  });

  it('Maj+Entrée fait un retour à la ligne sans envoyer ; pas d’envoi pendant la composition (IME)', async () => {
    installer();
    const direct = await ouvrirMessagerie();
    await userEvent.type(saisie(), 'ligne 1{Shift>}{Enter}{/Shift}ligne 2');
    expect(saisie()).toHaveValue('ligne 1\nligne 2');
    expect(direct.envoyees().filter((t) => t.type === 'envoyer')).toHaveLength(0);
    fireEvent.keyDown(saisie(), { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(direct.envoyees().filter((t) => t.type === 'envoyer')).toHaveLength(0);
  });

  it('un message vide n’est pas envoyé ; compteur limité à 2000 caractères', async () => {
    installer();
    await ouvrirMessagerie();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
    expect(saisie()).toHaveAttribute('maxlength', '2000');
    await userEvent.type(saisie(), 'abc');
    expect(screen.getByText(/3 \/ 2\s000/)).toBeInTheDocument();
  });

  it('sans connexion en direct, l’envoi passe par HTTP ; échec puis « Réessayer » avec la même cle_client', async () => {
    let tentative = 0;
    const fetch = installer({
      'POST /api/messagerie/messages/': (corps) => {
        tentative += 1;
        return tentative === 1
          ? reponse(500, { detail: 'boom' })
          : reponse(201, unMessage(20, { auteur_role: 'client', texte: corps.texte, cle_client: corps.cle_client }));
      },
    });
    rendreApp('/messages'); // le faux WebSocket inerte ne s'ouvre jamais
    await screen.findByRole('heading', { level: 1, name: 'Messagerie' });
    await userEvent.type(await screen.findByLabelText('Votre message'), 'Salut{Enter}');
    expect(await screen.findByText(/Échec de l'envoi/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByText(/Échec de l'envoi/)).not.toBeInTheDocument());
    expect(await screen.findByText(/Envoyé/)).toBeInTheDocument();
    const envois = appels(fetch, 'POST', '/api/messagerie/messages/');
    expect(envois).toHaveLength(2);
    expect(envois[0][0].cle_client).toBe(envois[1][0].cle_client);
    expect(envois[0][0]).toMatchObject({ texte: 'Salut' });
  });

  it('un message en échec peut être retiré', async () => {
    installer({ 'POST /api/messagerie/messages/': reponse(429, { detail: 'Trop de messages.', code: 'trop_de_messages' }) });
    rendreApp('/messages');
    await userEvent.type(await screen.findByLabelText('Votre message'), 'Hop{Enter}');
    expect(await screen.findByText(/Échec de l'envoi : Trop de messages\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(screen.queryByText('Hop')).not.toBeInTheDocument();
  });

  it('l’erreur du direct (quota) marque le message en attente comme échoué', async () => {
    installer();
    const direct = await ouvrirMessagerie();
    await userEvent.type(saisie(), 'Encore{Enter}');
    await screen.findByText(/Envoi…/);
    direct.recevoir({ type: 'erreur', code: 'trop_de_messages', detail: 'Vous écrivez trop vite.' });
    expect(await screen.findByText(/Échec de l'envoi : Vous écrivez trop vite\./)).toBeInTheDocument();
  });

  it('commande : liste des commandes du client, « à propos de » envoyé avec le message', async () => {
    installer({
      'GET /api/commandes/': reponse(200, page([{ id: 12, reference: 'CIR-2026-0012' }, { id: 13, reference: 'CIR-2026-0013' }])),
    });
    const direct = await ouvrirMessagerie();
    await userEvent.selectOptions(await screen.findByLabelText('À propos de… (facultatif)'), 'CIR-2026-0013');
    await userEvent.type(saisie(), 'Question{Enter}');
    expect(direct.envoyees().find((t) => t.type === 'envoyer')).toMatchObject({ commande: 13, texte: 'Question' });
    expect(await screen.findByRole('link', { name: 'À propos de CIR-2026-0013' })).toHaveAttribute('href', '/commandes/13');
  });

  it('?commande=12 présélectionne la commande', async () => {
    installer({ 'GET /api/commandes/': reponse(200, page([{ id: 12, reference: 'CIR-2026-0012' }])) });
    const direct = simulerDirect();
    rendreApp('/messages?commande=12');
    const choix = await screen.findByLabelText('À propos de… (facultatif)');
    await waitFor(() => expect(choix).toHaveValue('12'));
    await direct.attendreConnexion();
  });

  it('l’interface suit la langue : saisie et pièces jointes en anglais', async () => {
    installer();
    await ouvrirMessagerie();
    await userEvent.selectOptions(within(screen.getByRole('banner')).getByRole('combobox'), 'en');
    expect(await screen.findByLabelText('Your message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeInTheDocument();
  });

  describe('pièces jointes', () => {
    const fichier = (nom, type, taille = 1000) => {
      const f = new File(['x'.repeat(Math.min(taille, 50))], nom, { type });
      Object.defineProperty(f, 'size', { value: taille });
      return f;
    };
    const champ = () => screen.getByLabelText('Choisir des fichiers');

    it('refuse clairement un type interdit, un fichier trop lourd ou vide, avant l’envoi', async () => {
      const fetch = installer();
      await ouvrirMessagerie();
      fireEvent.change(champ(), { target: { files: [
        fichier('virus.exe', 'application/x-msdownload'),
        fichier('gros.pdf', 'application/pdf', 11 * 1024 * 1024),
        fichier('vide.pdf', 'application/pdf', 0),
      ] } });
      expect(await screen.findByText(/virus\.exe : type de fichier refusé/)).toBeInTheDocument();
      expect(screen.getByText(/gros\.pdf : fichier trop lourd \(10 Mo au plus\)/)).toBeInTheDocument();
      expect(screen.getByText(/vide\.pdf : le fichier est vide/)).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Fichiers à joindre' })).not.toBeInTheDocument();
      expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(0);
    });

    it('3 fichiers au plus ; retrait possible', async () => {
      installer();
      await ouvrirMessagerie();
      fireEvent.change(champ(), { target: { files: [
        fichier('a.pdf', 'application/pdf'), fichier('b.pdf', 'application/pdf'),
        fichier('c.pdf', 'application/pdf'), fichier('d.pdf', 'application/pdf'),
      ] } });
      const liste = await screen.findByRole('list', { name: 'Fichiers à joindre' });
      expect(within(liste).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByText(/d\.pdf : 3 fichiers au plus par message/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Retirer b.pdf' }));
      expect(within(liste).getAllByRole('listitem')).toHaveLength(2);
    });

    it('envoie les pièces jointes par HTTP (multipart), avec le texte et la cle_client', async () => {
      const fetch = installer({
        'POST /api/messagerie/messages/': (corps) => reponse(201, unMessage(30, {
          auteur_role: 'client', texte: corps.get('texte'), cle_client: corps.get('cle_client'),
          pieces_jointes: [{ id: 5, nom_original: 'plan.pdf', type: 'document', taille: 1000, url: '/api/messagerie/pieces-jointes/5/' }],
        })),
      });
      const direct = await ouvrirMessagerie();
      fireEvent.change(champ(), { target: { files: [fichier('plan.pdf', 'application/pdf')] } });
      await userEvent.type(saisie(), 'Voici le plan');
      await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
      await waitFor(() => expect(appels(fetch, 'POST', '/api/messagerie/messages/')).toHaveLength(1));
      const [[formulaire]] = appels(fetch, 'POST', '/api/messagerie/messages/');
      expect(formulaire).toBeInstanceOf(FormData);
      expect(formulaire.get('texte')).toBe('Voici le plan');
      expect(formulaire.get('cle_client')).toMatch(/^w-/);
      expect(formulaire.getAll('fichiers')).toHaveLength(1);
      expect(direct.envoyees().filter((t) => t.type === 'envoyer')).toHaveLength(0);
      expect(await screen.findByRole('button', { name: /Télécharger plan\.pdf/ })).toBeInTheDocument();
    });

    it('télécharge une pièce jointe privée avec le jeton de connexion', async () => {
      installer({}, { messages: [unMessage(1, {
        pieces_jointes: [{ id: 5, nom_original: 'devis.pdf', type: 'document', taille: 2048, url: '/api/messagerie/pieces-jointes/5/' }],
      })] });
      const brut = globalThis.fetch;
      const telechargement = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['pdf']) }));
      vi.stubGlobal('fetch', vi.fn((url, init) => (String(url).includes('pieces-jointes') ? telechargement(url, init) : brut(url, init))));
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      await ouvrirMessagerie();
      await userEvent.click(await screen.findByRole('button', { name: /Télécharger devis\.pdf/ }));
      await waitFor(() => expect(telechargement).toHaveBeenCalled());
      expect(telechargement.mock.calls[0][0]).toBe('http://localhost:8000/api/messagerie/pieces-jointes/5/');
      expect(telechargement.mock.calls[0][1].headers.Authorization).toBe('Bearer A1');
      await waitFor(() => expect(clic).toHaveBeenCalled());
      expect(clic.mock.contexts[0].download).toBe('devis.pdf');
      clic.mockRestore();
      delete URL.createObjectURL;
      delete URL.revokeObjectURL;
    });
  });

  describe('lecture', () => {
    it('marque lus les messages de l’équipe quand la page est visible et le bas atteint, et met à jour la pastille', async () => {
      const fetch = installer({
        'POST /api/messagerie/lu/': reponse(200, { non_lus: 0 }),
        'GET /api/messagerie/non-lus/': reponse(200, { non_lus: 2 }),
      }, { messages: [unMessage(4), unMessage(7)] });
      await ouvrirMessagerie();
      await waitFor(() => expect(appels(fetch, 'POST', '/api/messagerie/lu/')).toHaveLength(1));
      expect(appels(fetch, 'POST', '/api/messagerie/lu/')[0][0]).toEqual({ jusqu_a: 7 });
    });

    it('ne marque rien comme lu tant que l’onglet est caché', async () => {
      const fetch = installer({ 'POST /api/messagerie/lu/': reponse(200, { non_lus: 0 }) }, { messages: [unMessage(4)] });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      try {
        await ouvrirMessagerie();
        await screen.findByText('Message 4');
        expect(appels(fetch, 'POST', '/api/messagerie/lu/')).toHaveLength(0);
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
        await waitFor(() => expect(appels(fetch, 'POST', '/api/messagerie/lu/')).toHaveLength(1));
      } finally {
        delete document.visibilityState;
      }
    });

    it('le direct « lu » de l’équipe affiche « Lu » sous mes messages', async () => {
      installer({}, { messages: [unMessage(3, { auteur_role: 'client', texte: 'Mon message' })] });
      const direct = await ouvrirMessagerie();
      await screen.findByText(/Envoyé/);
      direct.recevoir({ type: 'lu', conversation: 1, par: 'equipe', jusqu_a: 3 });
      expect(await screen.findByText(/Lu$/)).toBeInTheDocument();
    });

    it('un message de l’équipe reçu en direct s’ajoute au fil ; « l’équipe écrit… » apparaît', async () => {
      installer({ 'POST /api/messagerie/lu/': reponse(200, { non_lus: 0 }) });
      const direct = await ouvrirMessagerie();
      direct.recevoir({ type: 'ecrit', conversation: 1, par: 'equipe' });
      expect(await screen.findByText("L'équipe écrit…")).toBeInTheDocument();
      direct.recevoir({ type: 'message', message: unMessage(9, { texte: 'Voici notre offre' }) });
      expect(await screen.findByText('Voici notre offre')).toBeInTheDocument();
      expect(screen.queryByText("L'équipe écrit…")).not.toBeInTheDocument();
    });

    it('envoie « ecrit » (au plus un toutes les 3 s) quand on tape', async () => {
      installer();
      const direct = await ouvrirMessagerie();
      await userEvent.type(saisie(), 'abc');
      expect(direct.envoyees().filter((t) => t.type === 'ecrit')).toHaveLength(1);
    });

    it('titre de l’onglet avec le nombre de messages non lus', async () => {
      installer();
      const direct = simulerDirect();
      rendreApp('/messages');
      await screen.findByRole('heading', { level: 1, name: 'Messagerie' });
      await direct.attendreConnexion();
      direct.connecter({ non_lus: 3 });
      await waitFor(() => expect(document.title).toMatch(/^\(3\) Messagerie/));
      expect(screen.getByText('3 messages non lus')).toBeInTheDocument();
    });
  });

  describe('historique et rattrapage', () => {
    it('« Charger les messages précédents » demande les messages avant le plus ancien', async () => {
      const fetch = installer({}, { messages: [unMessage(31), unMessage(32)], aPlus: true });
      await ouvrirMessagerie();
      await screen.findByText('Message 31');
      fetch.mockClear();
      await userEvent.click(screen.getByRole('button', { name: 'Charger les messages précédents' }));
      await waitFor(() => expect(parametresDes(fetch, '/api/messagerie/messages/')).toHaveLength(1));
      expect(parametresDes(fetch, '/api/messagerie/messages/')[0].get('avant')).toBe('31');
    });

    it('à la reconnexion, rattrape les messages manqués avec `apres`', async () => {
      let rattrapage = false;
      const fetch = installer({
        'GET /api/messagerie/messages/': (_c, _i, url) => {
          if (url.searchParams.get('apres')) {
            rattrapage = true;
            return reponse(200, { results: [unMessage(6, { texte: 'Manqué pendant la coupure' })], a_plus: false });
          }
          return reponse(200, { results: [unMessage(5)], a_plus: false });
        },
        'POST /api/messagerie/lu/': reponse(200, { non_lus: 0 }),
        'POST /api/comptes/connexion/rafraichir/': reponse(200, { acces: 'A2', rafraichissement: 'R1' }),
      });
      const direct = await ouvrirMessagerie();
      await screen.findByText('Message 5');
      direct.couper();
      expect(await screen.findByText(/Connexion en direct interrompue/)).toBeInTheDocument();
      // la reconnexion automatique crée un nouveau socket (après 1 s) : on la déclenche à la main via le jeton
      await waitFor(() => expect(direct.sockets.length).toBe(2), { timeout: 4000 });
      direct.connecter();
      expect(await screen.findByText('Manqué pendant la coupure')).toBeInTheDocument();
      expect(rattrapage).toBe(true);
      expect(parametresDes(fetch, '/api/messagerie/messages/').some((p) => p.get('apres') === '5')).toBe(true);
    });
  });
});
