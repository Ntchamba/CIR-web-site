// Notifications (équipe) : cloche en direct, liste, préférence e-mail, et, pour le super-administrateur,
// modèles d'e-mails et envois. API et WebSocket simulés.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { installerDirect } from '@/test/direct-simule.js';
import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

const SUPER = { id: 1, email: 'a@cir.cm', nom_complet: 'Awa Nana', role: 'super_admin', est_equipe: true, langue: 'fr' };
const NOTIF = [
  { id: 1, type: 'commande_nouvelle', titre: 'Nouvelle commande CIR-2026-0012', texte: 'Awa Nana a passé une commande.', lien: '/commandes/12', lue: false, cree_le: '2026-10-20T08:00:00Z' },
  { id: 2, type: 'message_nouveau', titre: 'Nouveau message', texte: '', lien: '/messagerie', lue: true, cree_le: '2026-10-19T08:00:00Z' },
  { id: 3, type: 'x', titre: 'Lien suspect', texte: '', lien: 'https://exemple.test/hameçon', lue: false, cree_le: '2026-10-19T07:00:00Z' },
];

/** Comme `simulerApi`, mais la personne connectée est le super-administrateur. */
function simulerSuper(routes) {
  const base = simulerApi(routes);
  const simule = vi.fn((url, options) => (String(url).includes('/api/comptes/moi/') ? reponse(200, SUPER) : base(url, options)));
  vi.stubGlobal('fetch', simule);
  return simule;
}

describe('CentreNotifications', () => {
  it('montre la pastille en direct, liste les dernières notifications et marque comme lu', async () => {
    const direct = installerDirect();
    const simule = simulerApi([
      ['POST', 'notifications/1/lue/', { ...NOTIF[0], lue: true }],
      ['GET', '/api/admin/notifications/', page(NOTIF)],
    ]);
    rendre('/');
    await waitFor(() => expect(direct.instances).toHaveLength(1));
    direct.connecter({ utilisateur: { id: 2, role: 'membre' }, non_lus: 0, notifications_non_lues: 2 });
    const cloche = await screen.findByRole('button', { name: 'Ouvrir les notifications (2 non lues)' });
    // Le compteur suit les trames `non_lus`.
    direct.recevoir({ type: 'non_lus', messagerie: 0, notifications: 5 });
    expect(await screen.findByRole('button', { name: 'Ouvrir les notifications (5 non lues)' })).toBe(cloche);

    const u = userEvent.setup();
    await u.click(cloche);
    const panneau = await screen.findByRole('region', { name: 'Notifications' });
    expect(await within(panneau).findByText('Nouvelle commande CIR-2026-0012')).toBeInTheDocument();
    expect(within(panneau).getByRole('link', { name: /Nouvelle commande CIR-2026-0012/ })).toHaveAttribute('href', '/commandes/12');
    await u.click(within(panneau).getByRole('link', { name: /Nouvelle commande CIR-2026-0012/ }));
    await waitFor(() => expect(appels(simule, 'POST', 'notifications/1/lue/')).toHaveLength(1));
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument(); // menu refermé
  });

  it("n'utilise jamais une adresse externe comme lien", async () => {
    installerDirect();
    simulerApi([['GET', '/api/admin/notifications/', page(NOTIF)]]);
    rendre('/');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ouvrir les notifications' }));
    const panneau = await screen.findByRole('region', { name: 'Notifications' });
    await within(panneau).findByText('Lien suspect');
    expect(within(panneau).queryByRole('link', { name: /Lien suspect/ })).not.toBeInTheDocument();
    expect(within(panneau).getByRole('button', { name: /Lien suspect/ })).toBeInTheDocument();
  });

  it('se referme avec Échap et rend le focus au bouton', async () => {
    installerDirect();
    simulerApi([['GET', '/api/admin/notifications/', page(NOTIF)]]);
    rendre('/');
    const u = userEvent.setup();
    const cloche = await screen.findByRole('button', { name: 'Ouvrir les notifications' });
    await u.click(cloche);
    await screen.findByRole('region', { name: 'Notifications' });
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(cloche).toHaveFocus();
  });
});

describe('NotificationsPage', () => {
  it('liste mes notifications, tout marquer comme lu, pas d\'onglets d\'administration pour un membre', async () => {
    installerDirect();
    const simule = simulerApi([
      ['POST', 'notifications/lues/', { count: 0 }],
      ['GET', 'notifications/preferences/', { email_equipe: true }],
      ['GET', '/api/admin/notifications/', page(NOTIF)],
    ]);
    rendre('/notifications?onglet=modeles');
    expect(await screen.findByText('Awa Nana a passé une commande.')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((o) => o.textContent)).toEqual(['Mes notifications']);
    expect(screen.queryByRole('heading', { name: 'Texte par défaut' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(appels(simule, 'POST', 'notifications/lues/')).toHaveLength(1));
  });

  it("enregistre la préférence « e-mail de l'équipe »", async () => {
    installerDirect();
    const simule = simulerApi([
      ['GET', 'notifications/preferences/', { email_equipe: true }],
      ['PATCH', 'notifications/preferences/', { email_equipe: false }],
      ['GET', '/api/admin/notifications/', page(NOTIF)],
    ]);
    rendre('/notifications');
    const case_ = await screen.findByRole('checkbox', { name: 'Recevoir aussi les notifications par e-mail' });
    await waitFor(() => expect(case_).toBeChecked());
    await userEvent.setup().click(case_);
    await waitFor(() => expect(appels(simule, 'PATCH', 'notifications/preferences/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', 'notifications/preferences/')[0][1].body)).toEqual({ email_equipe: false });
    await waitFor(() => expect(case_).not.toBeChecked());
  });

  it("affiche un état vide quand il n'y a aucune notification", async () => {
    installerDirect();
    simulerApi([]);
    rendre('/notifications');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aucune notification' })).toBeInTheDocument();
  });
});

const MODELES = [
  {
    evenement: 'commande_creee',
    langues: {
      fr: { defaut: { sujet: 'Votre commande {reference}', introduction: 'Bonjour {nom}, nous avons bien reçu votre commande.' }, modele: null },
      en: { defaut: { sujet: 'Your order {reference}', introduction: 'Hello {nom}, we received your order.' }, modele: { sujet: 'Order {reference} received', introduction: 'Hi {nom}!' } },
    },
  },
  {
    evenement: 'contrat_signe',
    langues: { fr: { defaut: { sujet: 'Contrat signé', introduction: 'Le contrat est signé pour {montant}.' }, modele: null } },
  },
];

describe('ModelesEmailsPage (super-administrateur)', { timeout: 15000 }, () => {
  it('montre le texte par défaut, enregistre le modèle et bloque les variables inconnues', async () => {
    installerDirect();
    const simule = simulerSuper([
      ['PUT', 'modeles/commande_creee/fr/', { sujet: 'Merci pour {reference}', introduction: 'Bonjour {nom} !' }],
      ['GET', 'notifications/modeles/', MODELES],
    ]);
    rendre('/notifications?onglet=modeles');
    const defaut = await screen.findByRole('region', { name: 'Texte par défaut' });
    expect(within(defaut).getByText('Votre commande {reference}')).toBeInTheDocument();
    expect(screen.getByText('Variables autorisées : {nom}, {reference}, {montant}, {etape}')).toBeInTheDocument();
    const u = userEvent.setup();
    const sujet = screen.getByLabelText('Sujet');
    const intro = screen.getByLabelText('Introduction');

    // Variable inconnue : refusée avant tout envoi.
    await u.clear(intro);
    await u.click(intro);
    await u.paste('Total : {prix}');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Variable non autorisée : {prix}.')).toBeInTheDocument();
    expect(appels(simule, 'PUT', 'modeles/')).toHaveLength(0);

    await u.clear(sujet);
    await u.click(sujet);
    await u.paste('Merci pour {reference}');
    await u.clear(intro);
    await u.click(intro);
    await u.paste('Bonjour {nom} !');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PUT', 'modeles/commande_creee/fr/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PUT', 'modeles/commande_creee/fr/')[0][1].body))
      .toEqual({ sujet: 'Merci pour {reference}', introduction: 'Bonjour {nom} !' });
    expect(await screen.findByText('Modèle enregistré.')).toBeInTheDocument();
    expect(screen.getByText('Un modèle personnalisé remplace ce texte par défaut.')).toBeInTheDocument();
  });

  it("affiche tel quel le libellé de l'événement traduit par le serveur", async () => {
    installerDirect();
    simulerSuper([['GET', 'notifications/modeles/', [{ ...MODELES[0], libelle: 'Order registered (server)' }]]]);
    rendre('/notifications?onglet=modeles');
    expect(await screen.findByRole('option', { name: 'Order registered (server)' })).toBeInTheDocument();
  });

  it('change d\'événement et de langue, rétablit le texte par défaut après confirmation', async () => {
    installerDirect();
    const simule = simulerSuper([
      ['DELETE', 'modeles/commande_creee/en/', () => Promise.resolve(new Response(null, { status: 204 }))],
      ['GET', 'notifications/modeles/', MODELES],
    ]);
    rendre('/notifications?onglet=modeles');
    const u = userEvent.setup();
    await screen.findByRole('region', { name: 'Texte par défaut' });
    await u.selectOptions(screen.getByLabelText('Langue'), 'en');
    expect(screen.getByLabelText('Sujet')).toHaveValue('Order {reference} received');
    expect(screen.getByLabelText('Introduction')).toHaveValue('Hi {nom}!');
    expect(within(screen.getByRole('region', { name: 'Texte par défaut' })).getByText('Your order {reference}')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Rétablir le texte par défaut' }));
    expect(screen.getByText('Supprimer ce modèle personnalisé et revenir au texte par défaut ?')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Rétablir le texte par défaut' })); // confirmation
    await waitFor(() => expect(appels(simule, 'DELETE', 'modeles/commande_creee/en/')).toHaveLength(1));
    await waitFor(() => expect(screen.getByLabelText('Sujet')).toHaveValue('Your order {reference}'));
    await u.selectOptions(screen.getByLabelText('Événement'), 'contrat_signe');
    await u.selectOptions(screen.getByLabelText('Langue'), 'fr');
    expect(screen.getByLabelText('Sujet')).toHaveValue('Contrat signé');
  });

  it("affiche l'aperçu dans un cadre isolé sans aucun droit", async () => {
    installerDirect();
    const simule = simulerSuper([
      ['POST', 'modeles/apercu/', { sujet: 'Votre commande CIR-EXEMPLE', corps_html: '<p>Bonjour Exemple</p><script>alert(1)</script>', corps_texte: 'Bonjour Exemple' }],
      ['GET', 'notifications/modeles/', MODELES],
    ]);
    rendre('/notifications?onglet=modeles');
    await screen.findByRole('region', { name: 'Texte par défaut' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Aperçu' }));
    const cadre = await screen.findByTitle("Aperçu de l'e-mail");
    expect(cadre.tagName).toBe('IFRAME');
    expect(cadre).toHaveAttribute('sandbox', '');
    expect(cadre.getAttribute('srcdoc')).toContain('Bonjour Exemple');
    expect(JSON.parse(appels(simule, 'POST', 'modeles/apercu/')[0][1].body)).toMatchObject({ evenement: 'commande_creee', langue: 'fr' });
  });
});

describe('EnvoisEmails (super-administrateur)', () => {
  const ENVOI = (id, etat, extra = {}) => ({
    id, destinataire_email: 'j***@exemple.cm', evenement: 'commande_creee', etat, tentatives: etat === 'echec' ? 5 : 1,
    derniere_erreur: '', cree_le: '2026-10-20T08:00:00Z', envoye_le: etat === 'envoye' ? '2026-10-20T08:01:00Z' : null, ...extra,
  });

  it("montre l'état de la file, l'erreur des échecs, et permet de réessayer", async () => {
    installerDirect();
    const simule = simulerSuper([
      ['GET', 'envois/resume/', { en_attente: 4, envoye: 120, echec: 1, annule: 2, gmail_configure: true }],
      ['POST', 'envois/8/reessayer/', ENVOI(8, 'en_attente')],
      ['GET', '/api/admin/notifications/envois/', page([ENVOI(7, 'envoye'), ENVOI(8, 'echec', { derniere_erreur: 'Quota dépassé' })])],
    ]);
    rendre('/notifications?onglet=envois');
    const decomptes = await screen.findByRole('list', { name: "État de la file d'envoi" });
    expect(within(decomptes).getByText('120')).toBeInTheDocument();
    expect(within(decomptes).getByText('Échecs')).toBeInTheDocument();
    expect(screen.queryByText(/Gmail n'est pas configuré/)).not.toBeInTheDocument();
    expect(await screen.findByText('Quota dépassé')).toBeInTheDocument();
    expect(screen.getAllByText('j***@exemple.cm')).toHaveLength(2); // adresses masquées par le serveur
    const boutons = screen.getAllByRole('button', { name: /^Réessayer l'envoi à/ });
    expect(boutons).toHaveLength(1); // seulement pour l'envoi en échec
    await userEvent.setup().click(boutons[0]);
    await waitFor(() => expect(appels(simule, 'POST', 'envois/8/reessayer/')).toHaveLength(1));
  });

  it("affiche l'erreur déjà traduite par le serveur", async () => {
    installerDirect();
    simulerSuper([
      ['GET', 'envois/resume/', { en_attente: 0, envoye: 0, echec: 1, annule: 0, gmail_configure: true }],
      ['GET', '/api/admin/notifications/envois/', page([ENVOI(8, 'echec', { derniere_erreur: 'Quota journalier atteint', derniere_erreur_code: 'quota' })])],
    ]);
    rendre('/notifications?onglet=envois');
    expect(await screen.findByText('Quota journalier atteint')).toBeInTheDocument();
    expect(screen.queryByText('quota')).not.toBeInTheDocument();
  });

  it("avertit quand Gmail n'est pas configuré", async () => {
    installerDirect();
    simulerSuper([
      ['GET', 'envois/resume/', { en_attente: 3, envoye: 0, echec: 0, annule: 0, gmail_configure: false }],
    ]);
    rendre('/notifications?onglet=envois');
    expect(await screen.findByRole('alert')).toHaveTextContent("Gmail n'est pas configuré");
  });

  it('filtre par état auprès du serveur', async () => {
    installerDirect();
    const simule = simulerSuper([
      ['GET', 'envois/resume/', { en_attente: 0, envoye: 1, echec: 1, annule: 0, gmail_configure: true }],
      ['GET', '/api/admin/notifications/envois/', page([ENVOI(7, 'envoye')])],
    ]);
    rendre('/notifications?onglet=envois');
    await screen.findByText('j***@exemple.cm');
    await userEvent.setup().selectOptions(screen.getByLabelText('État'), 'echec');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /envois\/\?etat=echec/.test(String(x)))).toBe(true));
  });
});
