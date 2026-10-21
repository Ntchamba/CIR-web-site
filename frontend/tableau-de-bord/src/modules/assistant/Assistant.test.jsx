// Assistant IA (équipe) : brouillons, statut et usage, journal, conversations (super-administrateur), bouton de brouillon
// dans la demande de contact, la messagerie et l'onglet de traductions. API simulée.
// Principe testé partout : un brouillon n'est JAMAIS inséré, envoyé ni publié sans un geste de l'équipe.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import OngletsLangues from '@/composants/OngletsLangues.jsx';
import { changerLangue } from '@/i18n/index.js';
import { reinitialiserStatutAssistant } from './api.js';
import { installerDirect } from '@/test/direct-simule.js';
import { appels, MEMBRE, page, reponse, rendre, simulerApi } from '@/test/api-simulee.jsx';

const SUPER_ADMIN = { ...MEMBRE, id: 1, nom_complet: 'Awa Nana', role: 'super_admin' };
const STATUT = {
  configure: true, modele_assistant: 'gemini-2.5-flash', modele_fond: 'gemini-2.5-flash', limite_jour: 1000,
  messages_aujourdhui: 120, messages_mois: 3400, jetons_mois: 250000,
};
const BROUILLON = {
  id: 11, type: 'reponse_contact', cible_type: 'demande_contact', cible_id: 4, langue: 'fr', contenu: 'Bonjour, nous revenons vers vous par devis.',
  etat: 'propose', bloque: '', cree_par: { id: 2, nom_complet: 'Jean Mbarga' }, traite_par: null, cree_le: '2026-10-20T09:00:00Z', traite_le: null,
};
const statut = (extra = {}) => ['GET', '/api/admin/assistant/statut/', { ...STATUT, ...extra }];

describe('AssistantEquipe : brouillons', () => {
  it('liste les brouillons avec l’avertissement permanent et filtre par type et état auprès du serveur', async () => {
    const simule = simulerApi([['GET', '/api/admin/assistant/brouillons/', page([BROUILLON])], statut()]);
    rendre('/assistant');
    expect(await screen.findByRole('heading', { level: 1, name: 'Assistant IA' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Brouillon n° 11' })).toBeInTheDocument();
    expect(screen.getByText('Proposition automatique : à relire avant tout usage')).toBeInTheDocument();
    expect(screen.getAllByText('Réponse à une demande de contact').length).toBeGreaterThan(0);
    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Type'), 'traduction');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('type=traduction'))).toBe(true));
    await u.selectOptions(screen.getByLabelText('État'), 'rejete');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => /type=traduction.*etat=rejete|etat=rejete.*type=traduction/.test(String(x)))).toBe(true));
  });

  it('état vide clair', async () => {
    simulerApi([['GET', '/api/admin/assistant/brouillons/', page([])]]);
    rendre('/assistant');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aucun brouillon' })).toBeInTheDocument();
  });

  it('détail : avertissement, code de garde-fou, texte relu ; « Accepter » ne fait que noter la décision', async () => {
    const simule = simulerApi([
      ['PATCH', '/api/admin/assistant/brouillons/11/', { ...BROUILLON, etat: 'accepte' }],
      ['GET', '/api/admin/assistant/brouillons/', page([{ ...BROUILLON, bloque: 'prix_non_autorise' }])],
    ]);
    rendre('/assistant');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Brouillon n° 11' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Brouillon n° 11' });
    expect(within(tiroir).getByText('Proposition automatique : à relire avant tout usage')).toBeInTheDocument();
    expect(within(tiroir).getByRole('alert')).toHaveTextContent('montant non autorisé retiré');
    expect(within(tiroir).getByLabelText('Texte proposé')).toHaveValue('Bonjour, nous revenons vers vous par devis.');
    // Sans modification, seul « Accepter » est possible.
    expect(within(tiroir).getByRole('button', { name: 'Accepter avec modifications' })).toBeDisabled();
    await u.click(within(tiroir).getByRole('button', { name: 'Accepter' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/brouillons/11/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/brouillons/11/')[0][1].body)).toEqual({ etat: 'accepte' });
    expect(await within(tiroir).findByText('Décision enregistrée.')).toBeInTheDocument();
    // Ni la demande de contact ni la messagerie ne sont touchées.
    expect(simule.mock.calls.filter(([x, o = {}]) => o.method && o.method !== 'GET' && !String(x).includes('/assistant/'))).toHaveLength(0);
  });

  it('« Accepter avec modifications » conserve le texte corrigé ; « Rejeter » n’envoie pas de contenu', async () => {
    const simule = simulerApi([
      ['PATCH', '/api/admin/assistant/brouillons/11/', (u, o) => ({ ...BROUILLON, ...JSON.parse(o.body) })],
      ['GET', '/api/admin/assistant/brouillons/', page([BROUILLON])],
    ]);
    rendre('/assistant');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Brouillon n° 11' }));
    const tiroir = await screen.findByRole('dialog');
    const champ = within(tiroir).getByLabelText('Texte proposé');
    await u.clear(champ);
    await u.type(champ, 'Texte corrigé');
    expect(within(tiroir).getByRole('button', { name: 'Accepter' })).toBeDisabled();
    await u.click(within(tiroir).getByRole('button', { name: 'Accepter avec modifications' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/brouillons/11/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/brouillons/11/')[0][1].body)).toEqual({ etat: 'modifie', contenu: 'Texte corrigé' });
    // Une fois traité, le brouillon n'est plus modifiable.
    expect(await within(tiroir).findByText(/déjà été traité/)).toBeInTheDocument();
    expect(within(tiroir).queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument();
  });

  it('brouillon de traductions : un champ par langue', async () => {
    simulerApi([['GET', '/api/admin/assistant/brouillons/', page([
      { ...BROUILLON, id: 12, type: 'traduction', cible_type: 'texte', cible_id: 0, contenu: { en: 'Epoxy floor', de: 'Epoxidboden' } },
    ])]]);
    rendre('/assistant');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Brouillon n° 12' }));
    const tiroir = await screen.findByRole('dialog');
    expect(within(tiroir).getByLabelText('Texte proposé en English')).toHaveValue('Epoxy floor');
    expect(within(tiroir).getByLabelText('Texte proposé en Deutsch')).toHaveValue('Epoxidboden');
  });
});

describe('AssistantEquipe : statut et usage', () => {
  async function ouvrirStatut(extra) {
    simulerApi([statut(extra)]);
    rendre('/assistant');
    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Statut et usage' }));
  }

  it('affiche modèles, messages du jour sur la limite avec jauge, messages et jetons du mois, sans alerte à 12 %', async () => {
    await ouvrirStatut();
    expect(await screen.findByText('Configuré')).toBeInTheDocument();
    expect(screen.getAllByText('gemini-2.5-flash')).toHaveLength(2);
    const jauge = screen.getByRole('meter');
    expect(jauge).toHaveAttribute('aria-valuenow', '120');
    expect(jauge).toHaveAttribute('aria-valuemax', '1000');
    expect(screen.getByText(/120 messages sur 1.000 autorisés aujourd'hui/)).toBeInTheDocument();
    expect(screen.getByText(/3.400/)).toBeInTheDocument();
    expect(screen.getByText(/250.000/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('alerte à partir de 80 % de la limite du jour, puis à la limite atteinte', async () => {
    await ouvrirStatut({ messages_aujourdhui: 800 });
    expect(await screen.findByRole('alert')).toHaveTextContent('80 % de la limite du jour');
  });

  it('limite atteinte : message clair', async () => {
    await ouvrirStatut({ messages_aujourdhui: 1000 });
    expect(await screen.findByRole('alert')).toHaveTextContent('La limite du jour est atteinte');
  });

  it('non configuré : message clair, aucun chiffre inventé', async () => {
    await ouvrirStatut({ configure: false, modele_assistant: '', modele_fond: '', limite_jour: 0, messages_aujourdhui: 0, messages_mois: null, jetons_mois: null });
    expect(await screen.findByRole('heading', { name: "L'assistant IA n'est pas configuré" })).toBeInTheDocument();
    expect(screen.getByText('Non configuré')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('JournalAssistant', () => {
  const LIGNE = {
    id: 1, agent: 'conseiller', utilisateur: null, modele: 'gemini-2.5-flash', outils: ['rechercher_produits'], resultat: 'ok', code: '',
    jetons_entree: 120, jetons_sortie: 45, duree_ms: 850, cree_le: '2026-10-20T09:00:00Z',
  };
  const CONVERSATION = { cle: 'abc-123', utilisateur: null, langue: 'en', contexte: {}, cree_le: '2026-10-20T09:00:00Z', derniere_activite_le: '2026-10-20T09:05:00Z' };

  it('affiche le journal sans donnée personnelle et le filtre par résultat', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/assistant/journal/resume/', { ok: 40, bloque: 2 }],
      ['GET', '/api/admin/assistant/journal/', page([LIGNE])],
    ]);
    rendre('/assistant/journal');
    expect(await screen.findByRole('heading', { level: 1, name: "Journal de l'assistant" })).toBeInTheDocument();
    const tableau = await screen.findByRole('table');
    expect(within(tableau).getByText('rechercher_produits')).toBeInTheDocument();
    expect(within(tableau).getByText('120 / 45')).toBeInTheDocument();
    expect(within(tableau).getByText('850 ms')).toBeInTheDocument();
    expect(screen.getByText('Réussi : 40')).toBeInTheDocument();
    expect(screen.getByText('Le journal ne contient ni texte de conversation ni donnée personnelle.')).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText('Résultat'), 'bloque');
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('journal/?resultat=bloque'))).toBe(true));
  });

  it('un membre simple ne voit pas les conversations et aucune demande n’est faite', async () => {
    const simule = simulerApi([['GET', '/api/admin/assistant/journal/', page([LIGNE])]]);
    rendre('/assistant/journal');
    await screen.findByRole('table');
    expect(screen.queryByRole('tab', { name: 'Conversations' })).not.toBeInTheDocument();
    expect(simule.mock.calls.some(([x]) => String(x).includes('/assistant/conversations/'))).toBe(false);
  });

  it('le super-administrateur lit les conversations en lecture seule, avec la note de consultation journalisée ; le HTML reste du texte', async () => {
    const simule = simulerApi([
      ['GET', '/api/admin/assistant/journal/', page([LIGNE])],
      ['GET', '/api/admin/assistant/conversations/abc-123/', {
        ...CONVERSATION,
        messages: [
          { id: 1, role: 'utilisateur', texte: '<img src=x onerror=alert(1)> bonjour', liens: [], bloque: false, cree_le: '2026-10-20T09:00:00Z' },
          { id: 2, role: 'assistant', texte: 'Réponse', liens: [], bloque: 'prix_non_autorise', cree_le: '2026-10-20T09:00:05Z' },
        ],
      }],
      ['GET', '/api/admin/assistant/conversations/', page([CONVERSATION])],
    ], SUPER_ADMIN);
    rendre('/assistant/journal');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('tab', { name: 'Conversations' }));
    expect(await screen.findByText(/Chaque consultation est journalisée/)).toBeInTheDocument();
    expect(screen.getByText('Visiteur sans compte')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Conversation n° 1' }));
    const tiroir = await screen.findByRole('dialog', { name: 'Conversation de l\'assistant' });
    expect(await within(tiroir).findByText('<img src=x onerror=alert(1)> bonjour')).toBeInTheDocument();
    expect(tiroir.querySelector('img')).toBeNull();
    expect(within(tiroir).getByText(/montant non autorisé retiré/)).toBeInTheDocument();
    expect(within(tiroir).getByText(/Consultation journalisée/, { selector: 'p' })).toBeInTheDocument();
    expect(within(tiroir).queryByRole('textbox')).not.toBeInTheDocument();
    expect(simule.mock.calls.filter(([, o = {}]) => o.method && o.method !== 'GET')).toHaveLength(0);
  });
});

describe('BoutonBrouillonIA : demande de contact', () => {
  const DEMANDE = {
    id: 4, reference: 'CTC-2026-0004', nom: 'Paul Eto', email: 'paul@x.cm', telephone: '699 11 22 33', type: 'question', creneau: '',
    message: 'Quel est le prix du vernis ?', produit: null, langue: 'fr', etat: 'nouvelle', reponse_equipe: '', notes_internes: '',
    auteur: null, cree_le: '2026-10-17T10:00:00Z', traitee_le: null,
  };
  const routesContact = (extra = [], configure = true) => [
    ...extra,
    ['GET', 'demandes/resume/', { nouvelle: 1, en_cours: 0, traitee: 0, total: 1 }],
    statut({ configure }),
    ['GET', '/api/admin/contact/demandes/', page([DEMANDE])],
  ];
  async function ouvrir() {
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'CTC-2026-0004' }));
    return { u, tiroir: await screen.findByRole('dialog') };
  }

  it('bouton masqué si le service n’est pas configuré', async () => {
    simulerApi(routesContact([], false));
    rendre('/contact');
    const { tiroir } = await ouvrir();
    await within(tiroir).findByLabelText("Réponse de l'équipe");
    expect(within(tiroir).queryByRole('button', { name: 'Proposer un brouillon de réponse' })).not.toBeInTheDocument();
  });

  it('bouton masqué si le statut est refusé ou en erreur', async () => {
    simulerApi(routesContact([['GET', '/api/admin/assistant/statut/', reponse(403, { detail: 'Interdit' })]]));
    rendre('/contact');
    const { tiroir } = await ouvrir();
    await within(tiroir).findByLabelText("Réponse de l'équipe");
    expect(within(tiroir).queryByRole('button', { name: 'Proposer un brouillon de réponse' })).not.toBeInTheDocument();
  });

  it('le brouillon s’affiche dans un volet et n’est copié dans la réponse que sur geste volontaire', async () => {
    const simule = simulerApi(routesContact([
      ['POST', '/api/admin/assistant/brouillons/', BROUILLON],
      ['PATCH', '/api/admin/assistant/brouillons/11/', { ...BROUILLON, etat: 'accepte' }],
    ]));
    rendre('/contact');
    const { u, tiroir } = await ouvrir();
    await u.click(await within(tiroir).findByRole('button', { name: 'Proposer un brouillon de réponse' }));
    const volet = await within(tiroir).findByRole('region', { name: "Brouillon de l'assistant" });
    expect(JSON.parse(appels(simule, 'POST', '/assistant/brouillons/')[0][1].body)).toEqual({ type: 'reponse_contact', cible_id: 4 });
    expect(within(volet).getByText('Proposition automatique : à relire avant tout usage')).toBeInTheDocument();
    expect(within(volet).getByRole('textbox')).toHaveValue('Bonjour, nous revenons vers vous par devis.');
    // Rien n'est inséré ni enregistré tant qu'on ne copie pas.
    const reponseEquipe = within(tiroir).getByLabelText("Réponse de l'équipe");
    expect(reponseEquipe).toHaveValue('');
    expect(appels(simule, 'PATCH', '/contact/demandes/')).toHaveLength(0);
    expect(appels(simule, 'PATCH', '/assistant/')).toHaveLength(0);
    // L'équipe corrige puis copie.
    await u.type(within(volet).getByRole('textbox'), ' Merci.');
    await u.click(within(volet).getByRole('button', { name: 'Copier dans la réponse' }));
    expect(reponseEquipe).toHaveValue('Bonjour, nous revenons vers vous par devis. Merci.');
    // Copier n'enregistre pas la demande : l'enregistrement reste le bouton habituel.
    expect(appels(simule, 'PATCH', '/contact/demandes/')).toHaveLength(0);
    await waitFor(() => expect(appels(simule, 'PATCH', '/assistant/brouillons/11/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/assistant/brouillons/11/')[0][1].body))
      .toEqual({ etat: 'modifie', contenu: 'Bonjour, nous revenons vers vous par devis. Merci.' });
  });

  it('une réponse déjà saisie n’est pas écrasée : le brouillon est ajouté en dessous', async () => {
    simulerApi(routesContact([
      ['POST', '/api/admin/assistant/brouillons/', BROUILLON],
      ['GET', '/api/admin/contact/demandes/', page([{ ...DEMANDE, reponse_equipe: 'Début de réponse.' }])],
    ]));
    rendre('/contact');
    const { u, tiroir } = await ouvrir();
    await u.click(await within(tiroir).findByRole('button', { name: 'Proposer un brouillon de réponse' }));
    await u.click(await within(tiroir).findByRole('button', { name: 'Copier dans la réponse' }));
    expect(within(tiroir).getByLabelText("Réponse de l'équipe")).toHaveValue('Début de réponse.\n\nBonjour, nous revenons vers vous par devis.');
  });

  it('« Rejeter le brouillon » ferme le volet sans rien copier', async () => {
    const simule = simulerApi(routesContact([
      ['POST', '/api/admin/assistant/brouillons/', BROUILLON],
      ['PATCH', '/api/admin/assistant/brouillons/11/', { ...BROUILLON, etat: 'rejete' }],
    ]));
    rendre('/contact');
    const { u, tiroir } = await ouvrir();
    await u.click(await within(tiroir).findByRole('button', { name: 'Proposer un brouillon de réponse' }));
    await u.click(await within(tiroir).findByRole('button', { name: 'Rejeter le brouillon' }));
    await waitFor(() => expect(within(tiroir).queryByRole('region', { name: "Brouillon de l'assistant" })).not.toBeInTheDocument());
    expect(JSON.parse(appels(simule, 'PATCH', '/assistant/brouillons/11/')[0][1].body)).toEqual({ etat: 'rejete' });
    expect(within(tiroir).getByLabelText("Réponse de l'équipe")).toHaveValue('');
  });

  it('affiche le code de garde-fou et traduit les erreurs 429 et 503', async () => {
    let appel = 0;
    simulerApi(routesContact([['POST', '/api/admin/assistant/brouillons/', () => {
      appel += 1;
      if (appel === 1) return reponse(429, { detail: 'Throttled', code: 'assistant_trop_de_messages' });
      if (appel === 2) return reponse(503, { detail: 'Indisponible', code: 'assistant_indisponible' });
      return reponse(201, { ...BROUILLON, bloque: 'engagement' });
    }]]));
    rendre('/contact');
    const { u, tiroir } = await ouvrir();
    const bouton = await within(tiroir).findByRole('button', { name: 'Proposer un brouillon de réponse' });
    await u.click(bouton);
    expect(await within(tiroir).findByText(/Trop de brouillons demandés/)).toBeInTheDocument();
    await u.click(bouton);
    expect(await within(tiroir).findByText(/momentanément indisponible/)).toBeInTheDocument();
    await u.click(bouton);
    expect(await within(tiroir).findByText(/engagement retiré/)).toBeInTheDocument();
    expect(within(tiroir).queryByText(/Trop de brouillons/)).not.toBeInTheDocument();
  });
});

describe('BoutonBrouillonIA : messagerie', () => {
  const CLIENT = { id: 7, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '699 11 22 33', langue: 'fr' };
  const CONVERSATION = {
    id: 5, client: CLIENT, non_lus: 0, dernier_message_le: '2026-10-20T08:30:00Z',
    dernier_message: { texte: 'Bonjour', auteur_role: 'client', cree_le: '2026-10-20T08:30:00Z' },
  };

  it('le brouillon n’est ni envoyé ni mis dans la saisie avant « Copier dans la saisie »', async () => {
    installerDirect();
    const simule = simulerApi([
      statut(),
      ['POST', '/api/admin/assistant/brouillons/', { ...BROUILLON, type: 'reponse_message', cible_type: 'conversation', cible_id: 5, contenu: 'Bonjour Awa, avec plaisir.' }],
      ['PATCH', '/api/admin/assistant/brouillons/', { ...BROUILLON, etat: 'accepte' }],
      ['GET', /conversations\/5\/messages\//, { results: [], a_plus: false }],
      ['GET', '/api/admin/messagerie/conversations/', page([CONVERSATION])],
    ]);
    rendre('/messagerie');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Awa Nana/ }));
    await u.click(await screen.findByRole('button', { name: 'Proposer un brouillon' }));
    const volet = await screen.findByRole('region', { name: "Brouillon de l'assistant" });
    expect(JSON.parse(appels(simule, 'POST', '/assistant/brouillons/')[0][1].body)).toEqual({ type: 'reponse_message', cible_id: 5 });
    const saisie = screen.getByLabelText('Votre message');
    expect(saisie).toHaveValue('');
    await u.click(within(volet).getByRole('button', { name: 'Copier dans la saisie' }));
    expect(saisie).toHaveValue('Bonjour Awa, avec plaisir.');
    // Toujours rien d'envoyé à la messagerie : « Envoyer » reste un geste.
    expect(appels(simule, 'POST', '/api/admin/messagerie/conversations/5/messages/')).toHaveLength(0);
  });
});

describe('BoutonBrouillonIA : onglets de traductions', () => {
  function Harnais({ francais = 'Sol époxy' }) {
    const [form, setForm] = useState({ nom: francais, description: 'Résine brillante', traductions: {} });
    return (
      <form>
        <OngletsLangues contexteIA="produit" champs={[{ nom: 'nom', libelle: 'Nom' }, { nom: 'description', libelle: 'Description', multiligne: true }]}
          valeurs={form} traductions={form.traductions}
          surChangement={(c, v) => setForm((f) => ({ ...f, [c]: v }))}
          surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))} />
      </form>
    );
  }
  const traduction = (nom) => ({
    ...BROUILLON, id: nom === 'Sol époxy' ? 21 : 22, type: 'traduction', cible_type: 'texte', cible_id: 0,
    contenu: nom === 'Sol époxy' ? { en: 'Epoxy floor', de: 'Epoxidboden' } : { en: 'Glossy resin', de: 'Glänzendes Harz' },
  });

  it('propose les traductions de chaque champ rempli ; rien n’est écrit avant la copie', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    const simule = simulerApi([
      statut(),
      ['POST', '/api/admin/assistant/brouillons/', (u, o) => traduction(JSON.parse(o.body).texte)],
      ['PATCH', '/api/admin/assistant/brouillons/', { ...BROUILLON, etat: 'accepte' }],
    ]);
    render(<Harnais />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: /English/ }));
    await u.click(await screen.findByRole('button', { name: 'Proposer des traductions' }));
    const volet = await screen.findByRole('region', { name: "Brouillon de l'assistant" });
    const envois = appels(simule, 'POST', '/assistant/brouillons/').map(([, o]) => JSON.parse(o.body));
    expect(envois).toEqual([
      { type: 'traduction', texte: 'Sol époxy', contexte: 'produit' },
      { type: 'traduction', texte: 'Résine brillante', contexte: 'produit' },
    ]);
    // Le volet est visible, mais le champ anglais reste vide.
    expect(screen.getByLabelText('Nom (English)')).toHaveValue('');
    expect(within(volet).getByLabelText('Nom · English')).toHaveValue('Epoxy floor');
    // Copie d'une seule proposition.
    await u.click(within(volet).getByRole('button', { name: 'Copier dans le champ : Nom · English' }));
    expect(screen.getByLabelText('Nom (English)')).toHaveValue('Epoxy floor');
    expect(screen.getByLabelText('Description (English)')).toHaveValue('');
    // Tout copier remplit aussi les autres langues.
    await u.click(within(volet).getByRole('button', { name: 'Tout copier' }));
    expect(screen.getByLabelText('Description (English)')).toHaveValue('Glossy resin');
    await u.click(screen.getByRole('tab', { name: /Deutsch/ }));
    expect(screen.getByLabelText('Nom (Deutsch)')).toHaveValue('Epoxidboden');
  });

  it('une traduction déjà saisie n’est jamais écrasée (ajout en dessous) et le français n’entre jamais dans une traduction', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    simulerApi([
      statut(),
      ['POST', '/api/admin/assistant/brouillons/', { ...BROUILLON, id: 31, type: 'traduction', contenu: { fr: 'Sol époxy', en: 'Epoxy floor' } }],
      ['PATCH', '/api/admin/assistant/brouillons/', { ...BROUILLON, etat: 'accepte' }],
    ]);
    render(<Harnais />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: /English/ }));
    await u.type(screen.getByLabelText('Nom (English)'), 'Mon texte');
    await u.click(await screen.findByRole('button', { name: 'Proposer des traductions' }));
    const volet = await screen.findByRole('region', { name: "Brouillon de l'assistant" });
    // Aucun champ « français » proposé dans le volet de traduction.
    expect(within(volet).queryByLabelText(/Français/)).not.toBeInTheDocument();
    await u.click(within(volet).getAllByRole('button', { name: /Copier dans le champ/ })[0]);
    expect(screen.getByLabelText('Nom (English)')).toHaveValue('Mon texte Epoxy floor');
    await u.click(screen.getByRole('tab', { name: /Français/ }));
    expect(screen.getByLabelText('Nom')).toHaveValue('Sol époxy');
  });

  it('actif tant qu’un champ français est rempli ; masqué si non configuré', async () => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
    simulerApi([statut()]);
    const { unmount } = render(<Harnais francais="" />);
    // La description reste remplie : le bouton est actif tant qu'un champ l'est.
    await userEvent.setup().click(screen.getByRole('tab', { name: /English/ }));
    expect(await screen.findByRole('button', { name: 'Proposer des traductions' })).toBeEnabled();
    unmount();
    reinitialiserStatutAssistant();
    simulerApi([statut({ configure: false })]);
    render(<Harnais />);
    await userEvent.setup().click(screen.getByRole('tab', { name: /English/ }));
    await screen.findByLabelText('Nom (English)');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Proposer des traductions' })).not.toBeInTheDocument();
  });
});

describe('Assistant IA : langues', () => {
  it('la page s’affiche en japonais, sans clé brute', async () => {
    simulerApi([['GET', '/api/admin/assistant/brouillons/', page([BROUILLON])], statut()]);
    await changerLangue('ja');
    rendre('/assistant');
    expect(await screen.findByRole('heading', { level: 1, name: 'AI アシスタント' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '下書き 11 番' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/assistant\.[a-z]+\./);
  });
});
