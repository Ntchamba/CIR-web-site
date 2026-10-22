// Tests de la page « Réalisations » : chantiers et avant / après, démos chargées au clic, témoignages
// dans leur langue, formulaire de témoignage (visiteur, client connecté).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  appels, connecterLocalement, emplacement, page, parametresDes, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR,
} from '@/test/outils.jsx';

import { adresseIntegration, validerTemoignage } from './regles.js';
import VitrinePage from './VitrinePage.jsx';

const REALISATION = {
  id: 1,
  slug: 'garage-bonapriso',
  titre: 'Garage à Bonapriso',
  type_chantier: 'maison',
  ville: 'Douala',
  description: 'Sol du garage refait.',
  image_avant: { url: 'https://api.test/media/avant.webp', alt: '' },
  image_apres: { url: 'https://api.test/media/apres.webp', alt: '' },
  date: '2026-09-01',
  produits: [{ slug: 'yd-500', nom: 'Sol autolissant' }],
};

const DEMOS = [
  {
    id: 1, titre: 'Pose d’un primaire', description: '', video: null, lien: 'https://youtu.be/abc',
    integration: 'https://www.youtube-nocookie.com/embed/abc', miniature: null, duree: '1:45',
  },
  {
    id: 2, titre: 'Finition', description: '', video: 'https://api.test/media/finition.mp4', lien: null,
    integration: null, miniature: { url: 'https://api.test/media/m.webp', alt: '' }, duree: '',
  },
];

const TEMOIGNAGE = {
  id: 1, nom_affiche: 'Client Test', ville: 'Douala', type_chantier: 'entreprise',
  texte: 'Very clean work, the floor is perfect.', note: 4, langue: 'en', date: '2026-10-01',
};

function api({ realisations = [REALISATION], demos = DEMOS, temoignages = [TEMOIGNAGE], autres = {} } = {}) {
  return simulerApi({
    'GET /api/vitrine/realisations/': reponse(200, page(realisations)),
    'GET /api/vitrine/demos/': reponse(200, page(demos)),
    'GET /api/vitrine/temoignages/': reponse(200, page(temoignages)),
    ...autres,
  });
}

const rendre = (chemin = '/realisations') => rendreAvecRoutes(chemin, {
  '/realisations': <VitrinePage />,
  '/connexion': <p>Page connexion</p>,
});

describe('VitrinePage : réalisations', () => {
  it('affiche le chantier avec un curseur avant / après utilisable au clavier', async () => {
    api();
    rendre();
    expect(await screen.findByRole('heading', { level: 3, name: 'Garage à Bonapriso' })).toBeInTheDocument();
    expect(screen.getByText(/Maison · Douala · septembre 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sol autolissant' })).toHaveAttribute('href', '/catalogue/yd-500');
    expect(screen.getByRole('img', { name: 'Garage à Bonapriso, avant les travaux' })).toHaveAttribute('loading', 'lazy');
    const curseur = screen.getByRole('slider', { name: 'Comparer avant et après : Garage à Bonapriso' });
    expect(curseur).toHaveAttribute('aria-valuetext', '50 % avant, 50 % après');
    fireEvent.change(curseur, { target: { value: '70' } });
    expect(curseur).toHaveAttribute('aria-valuetext', '70 % avant, 30 % après');
  });

  it('filtre par type de chantier (?type= dans l’adresse et dans la requête)', async () => {
    const fetch = api();
    rendre();
    await screen.findByRole('heading', { level: 3, name: 'Garage à Bonapriso' });
    const filtres = screen.getByRole('group', { name: 'Type de chantier' });
    await userEvent.click(within(filtres).getByRole('button', { name: 'Industries' }));
    await waitFor(() => expect(emplacement()).toBe('/realisations?type=industrie'));
    await waitFor(() => expect(parametresDes(fetch, '/api/vitrine/realisations/').at(-1).get('type')).toBe('industrie'));
  });

  it('rien de publié : états vides traduits, aucun chantier ni témoignage inventé', async () => {
    api({ realisations: [], demos: [], temoignages: [] });
    rendre();
    expect(await screen.findByRole('heading', { name: 'Aucun chantier publié pour le moment' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Démonstrations' })).toBeNull(); // pas de section vide : la vidéo de la transformation suffit
    expect(await screen.findByRole('heading', { name: 'Aucun témoignage publié pour le moment' })).toBeInTheDocument();
    expect(screen.queryByRole('blockquote')).toBeNull();
  });
});

describe('VitrinePage : démonstrations', () => {
  it('le lecteur YouTube (sans cookie) et la vidéo ne se chargent qu’au clic', async () => {
    api();
    const { container } = rendre();
    const lireYoutube = await screen.findByRole('button', { name: 'Lire la vidéo : Pose d’un primaire (1:45)' });
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('video')).toBeNull();

    await userEvent.click(lireYoutube);
    const iframe = screen.getByTitle('Vidéo : Pose d’un primaire');
    expect(iframe.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc?autoplay=1');

    await userEvent.click(screen.getByRole('button', { name: 'Lire la vidéo : Finition' }));
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://api.test/media/finition.mp4');
  });

  it('adresse d’intégration non reconnue : jamais intégrée', () => {
    expect(adresseIntegration('https://exemple.com/embed/x')).toBeNull();
    expect(adresseIntegration('javascript:alert(1)')).toBeNull();
    expect(adresseIntegration('http://player.vimeo.com/video/1')).toBeNull();
    expect(adresseIntegration('https://player.vimeo.com/video/1')).toBe('https://player.vimeo.com/video/1?autoplay=1');
  });
});

describe('VitrinePage : témoignages', () => {
  it('texte du client dans sa langue d’origine (attribut lang), note annoncée', async () => {
    api();
    rendre();
    const texte = await screen.findByText('Very clean work, the floor is perfect.');
    expect(texte.closest('blockquote')).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('img', { name: '4 étoiles sur 5' })).toBeInTheDocument();
    expect(screen.getByText(/Client Test · Entreprise · Douala/)).toBeInTheDocument();
  });

  it('visiteur : lien vers la connexion avec retour sur la page', async () => {
    api();
    rendre();
    const lien = await screen.findByRole('link', { name: 'Se connecter' });
    expect(lien).toHaveAttribute('href', '/connexion?suite=%2Frealisations');
  });

  it('client connecté : contrôle avant envoi, envoi, message « en attente de validation »', async () => {
    connecterLocalement();
    const fetch = api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, []),
        'POST /api/vitrine/temoignages/': (corps) => reponse(201, { id: 9, ...corps, statut: 'en_attente' }),
      },
    });
    rendre();
    const u = userEvent.setup();
    const envoyer = await screen.findByRole('button', { name: 'Envoyer mon témoignage' });

    await u.click(envoyer);
    expect(screen.getByText('Choisissez une note de 1 à 5 étoiles.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Votre témoignage/)).toHaveAccessibleDescription(/Écrivez votre témoignage\./);
    expect(appels(fetch, 'POST', '/api/vitrine/temoignages/')).toHaveLength(0);

    await u.click(screen.getByRole('radio', { name: '5 étoiles sur 5' }));
    await u.type(screen.getByLabelText(/Votre témoignage/), '  Très beau travail, équipe sérieuse et ponctuelle.  ');
    await u.selectOptions(screen.getByLabelText('Type de chantier (facultatif)'), 'maison');
    await u.click(envoyer);

    expect(await screen.findByText('Merci pour votre témoignage !')).toBeInTheDocument();
    expect(screen.getByText(/en attente de validation/)).toBeInTheDocument();
    const [[corps, init]] = appels(fetch, 'POST', '/api/vitrine/temoignages/');
    expect(corps).toEqual({ texte: 'Très beau travail, équipe sérieuse et ponctuelle.', note: 5, type_chantier: 'maison' });
    expect(init.headers.Authorization).toBe('Bearer A1');
    expect(screen.getByLabelText(/Votre témoignage/)).toHaveValue('');
  });

  it('client connecté : ses témoignages et leur statut (motif si refusé)', async () => {
    connecterLocalement();
    api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, [
          { id: 3, texte: 'Texte en attente de relecture.', note: 5, statut: 'en_attente' },
          { id: 4, texte: 'Texte refusé par l’équipe.', note: 1, statut: 'refuse', motif_refus: 'Numéro de téléphone.' },
        ]),
      },
    });
    rendre();
    expect(await screen.findByText('En attente de validation')).toBeInTheDocument();
    expect(screen.getByText('Refusé')).toBeInTheDocument();
    expect(screen.getByText('Motif : Numéro de téléphone.')).toBeInTheDocument();
  });

  it('erreur du serveur sur un champ : affichée sous le champ', async () => {
    connecterLocalement();
    api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, []),
        'POST /api/vitrine/temoignages/': reponse(400, { texte: ['Les liens ne sont pas autorisés.'] }),
      },
    });
    rendre();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('radio', { name: '4 étoiles sur 5' }));
    await u.type(screen.getByLabelText(/Votre témoignage/), 'Voir mon site www.exemple.com pour les photos');
    await u.click(screen.getByRole('button', { name: 'Envoyer mon témoignage' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Votre témoignage/)).toHaveAccessibleDescription(/Les liens ne sont pas autorisés\./);
  });
});

describe('validerTemoignage', () => {
  it('longueur de 20 à 800 caractères, note de 1 à 5', () => {
    expect(validerTemoignage({ texte: 'trop court', note: 3 })).toHaveProperty('texte');
    expect(validerTemoignage({ texte: 'x'.repeat(801), note: 3 })).toHaveProperty('texte');
    expect(validerTemoignage({ texte: 'x'.repeat(20), note: 6 })).toEqual({ note: 'Choisissez une note de 1 à 5 étoiles.' });
    expect(validerTemoignage({ texte: 'x'.repeat(20), note: '5' })).toEqual({});
  });
});
