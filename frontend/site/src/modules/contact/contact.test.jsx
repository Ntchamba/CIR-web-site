// Contact : formulaire (visiteur, client, rappel, champ piège, erreurs, 429), page Contact et Mes demandes.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, reponse, rendreApp, routesClient, simulerApi } from '@/test/outils.jsx';

const envoyer = (u) => u.click(screen.getByRole('button', { name: 'Envoyer' }));

describe('SectionContact', () => {
  it('visiteur : en bas de l’accueil, nom et coordonnées exigés avant tout envoi', async () => {
    const fetch = simulerApi();
    rendreApp('/');
    const u = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Une question ? Un rappel ?' })).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Votre message/), 'Bonjour, un devis svp');
    await envoyer(u);
    expect(await screen.findByText('Indiquez votre nom.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez un e-mail ou un téléphone.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/contact/demandes/')).toHaveLength(0);
  });

  it('visiteur : envoi d’une question, succès annoncé, formulaire vidé du message', async () => {
    const fetch = simulerApi({ 'POST /api/contact/demandes/': reponse(201, { id: 1, reference: 'CTC-2026-0001' }) });
    rendreApp('/contact');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Nom complet/), 'Jean Mbarga');
    await u.type(screen.getByLabelText('E-mail'), 'jean@exemple.cm');
    await u.type(screen.getByLabelText(/Votre message/), 'Bonjour, un devis svp');
    await envoyer(u);
    expect(await screen.findByText('Merci, votre demande est envoyée.')).toBeInTheDocument();
    expect(screen.getByText(/Référence : CTC-2026-0001/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Suivre mes demandes' })).toBeNull(); // pas de suivi sans compte
    const [[corps]] = appels(fetch, 'POST', '/api/contact/demandes/');
    expect(corps).toEqual({ type: 'question', message: 'Bonjour, un devis svp', site_web: '', nom: 'Jean Mbarga', email: 'jean@exemple.cm' });
    expect(screen.getByLabelText(/Votre message/)).toHaveValue('');
  });

  it('rappel : créneau proposé, téléphone obligatoire, créneau envoyé', async () => {
    const fetch = simulerApi({ 'POST /api/contact/demandes/': reponse(201, { id: 2, reference: 'CTC-2026-0002' }) });
    rendreApp('/contact');
    const u = userEvent.setup();
    expect(screen.queryByLabelText('Créneau pour le rappel')).toBeNull();
    await u.click(await screen.findByRole('radio', { name: 'Être rappelé(e)' }));
    await u.type(screen.getByLabelText(/Nom complet/), 'Jean');
    await u.type(screen.getByLabelText(/Votre message/), 'Rappelez-moi');
    await envoyer(u);
    expect(await screen.findByText('Indiquez un numéro de téléphone pour être rappelé.')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Téléphone/), '+237699111222');
    await u.selectOptions(screen.getByLabelText('Créneau pour le rappel'), 'soir');
    await envoyer(u);
    expect(await screen.findByText('Merci, votre demande est envoyée.')).toBeInTheDocument();
    expect(appels(fetch, 'POST', '/api/contact/demandes/')[0][0]).toMatchObject({ type: 'rappel', creneau: 'soir', telephone: '+237699111222' });
  });

  it('champ piège : masqué aux lecteurs d’écran et au clavier, envoyé vide', async () => {
    simulerApi();
    rendreApp('/contact');
    const piege = (await screen.findByText('Laissez ce champ vide')).closest('[aria-hidden="true"]');
    expect(piege).not.toBeNull();
    const champ = piege.querySelector('input[name="site_web"]');
    expect(champ).toHaveAttribute('tabindex', '-1');
    expect(champ).toHaveValue('');
    expect(screen.queryByRole('textbox', { name: 'Laissez ce champ vide' })).toBeNull();
  });

  it('champ piège rempli par un robot : la valeur part telle quelle (le serveur ignore la demande)', async () => {
    const fetch = simulerApi({ 'POST /api/contact/demandes/': reponse(201, { id: 0, reference: '' }) });
    rendreApp('/contact');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Nom complet/), 'Bot');
    await u.type(screen.getByLabelText('E-mail'), 'bot@exemple.cm');
    await u.type(screen.getByLabelText(/Votre message/), 'Achetez maintenant');
    const piege = document.querySelector('input[name="site_web"]');
    await u.type(piege, 'http://spam.example');
    await envoyer(u);
    await waitFor(() => expect(appels(fetch, 'POST', '/api/contact/demandes/')).toHaveLength(1));
    expect(appels(fetch, 'POST', '/api/contact/demandes/')[0][0].site_web).toBe('http://spam.example');
  });

  it('429 : message traduit ; 400 du serveur : erreur sous le champ', async () => {
    simulerApi({ 'POST /api/contact/demandes/': reponse(429, { detail: 'throttled' }) });
    rendreApp('/contact');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Nom complet/), 'Jean');
    await u.type(screen.getByLabelText('E-mail'), 'jean@exemple.cm');
    await u.type(screen.getByLabelText(/Votre message/), 'Bonjour à tous');
    await envoyer(u);
    expect(await screen.findByText('Trop de demandes envoyées. Réessayez plus tard ou appelez-nous.')).toBeInTheDocument();
  });

  it('erreur de champ du serveur sous le champ message', async () => {
    simulerApi({ 'POST /api/contact/demandes/': reponse(400, { message: ['Les liens ne sont pas autorisés.'] }) });
    rendreApp('/contact');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Nom complet/), 'Jean');
    await u.type(screen.getByLabelText('E-mail'), 'jean@exemple.cm');
    await u.type(screen.getByLabelText(/Votre message/), 'voir http://x.cm');
    await envoyer(u);
    await waitFor(() => expect(screen.getByLabelText(/Votre message/)).toHaveAttribute('aria-invalid', 'true'));
  });

  it('client connecté : champs préremplis depuis le compte, coordonnées reprises, lien de suivi', async () => {
    const fetch = simulerApi(routesClient({ 'POST /api/contact/demandes/': reponse(201, { id: 3, reference: 'CTC-2026-0003' }) }));
    rendreApp('/contact');
    const u = userEvent.setup();
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Awa Ngono'));
    expect(screen.getByLabelText('E-mail')).toHaveValue('awa@exemple.cm');
    await u.type(screen.getByLabelText(/Votre message/), 'Question sur le YD-306');
    await envoyer(u);
    expect(await screen.findByRole('link', { name: 'Suivre mes demandes' })).toHaveAttribute('href', '/mes-demandes');
    expect(appels(fetch, 'POST', '/api/contact/demandes/')[0][0]).toMatchObject({ nom: 'Awa Ngono', email: 'awa@exemple.cm', telephone: '+237699000000' });
  });
});

describe('MesDemandesPage', () => {
  it('visiteur : renvoyé vers la connexion', async () => {
    simulerApi();
    rendreApp('/mes-demandes');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Se connecter' })).toBeInTheDocument());
  });

  it('demandes de rendu et de contact avec la réponse de l’équipe (texte tel quel), liens vers les devis', async () => {
    simulerApi(routesClient({
      'GET /api/devis/demandes-rendu/': reponse(200, page([{
        id: 1, reference: 'REN-2026-0001', description: 'Garage gris', type_batiment: 'maison', surface_m2: '30.00',
        produit: { id: 3, slug: 'yd', reference: 'YD-306', nom: 'Sable coloré' }, commande: null,
        images: [{ url: 'https://api.test/m/1.webp', alt: '' }], etat: 'devis_envoye', reponse_equipe: 'Voici notre devis.',
        devis: [{ id: 5, reference: 'DEV-2026-0005', commande: 7 }], cree_le: '2026-10-16T09:00:00Z',
      }])),
      'GET /api/contact/demandes/miennes/': reponse(200, page([{
        id: 2, reference: 'CTC-2026-0002', type: 'rappel', creneau: 'soir', message: 'Rappelez-moi', produit: null,
        etat: 'traitee', reponse_equipe: 'Appel effectué.', cree_le: '2026-10-16T09:00:00Z', traitee_le: '2026-10-17T09:00:00Z',
      }])),
    }));
    rendreApp('/mes-demandes');
    const rendu = await screen.findByRole('region', { name: 'Demandes de rendu' });
    expect(await within(rendu).findByText('Devis envoyé')).toBeInTheDocument();
    expect(within(rendu).getByText('Voici notre devis.')).toBeInTheDocument();
    expect(within(rendu).getByRole('link', { name: 'Voir le devis DEV-2026-0005' })).toHaveAttribute('href', '/commandes/7');
    const contact = screen.getByRole('region', { name: 'Messages et rappels' });
    expect(await within(contact).findByText('Appel effectué.')).toBeInTheDocument();
    expect(within(contact).getByText(/Être rappelé\(e\) · Le soir/)).toBeInTheDocument();
    expect(within(contact).getByText('Traitée')).toBeInTheDocument();
  });

  it('listes vides : messages dédiés', async () => {
    simulerApi(routesClient({
      'GET /api/devis/demandes-rendu/': reponse(200, page([])),
      'GET /api/contact/demandes/miennes/': reponse(200, page([])),
    }));
    rendreApp('/mes-demandes');
    expect(await screen.findByText("Vous n'avez pas encore fait de demande de rendu.")).toBeInTheDocument();
    expect(screen.getByText("Vous n'avez pas encore écrit à l'équipe.")).toBeInTheDocument();
  });
});
