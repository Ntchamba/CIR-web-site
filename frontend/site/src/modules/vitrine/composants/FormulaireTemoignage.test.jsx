// Tests (site-testeur) de la vitrine : quota de témoignages (429), « mes témoignages » paginés, « Voir plus » en
// erreur, démos (lien externe, adresse non reconnue), requêtes publiques sans jeton, contenu jamais interprété en HTML.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { changerLangue } from '@/i18n/index.js';
import {
  appels, connecterLocalement, page, reponse, rendreAvecRoutes, simulerApi, UTILISATEUR,
} from '@/test/outils.jsx';

import VitrinePage from '../VitrinePage.jsx';
import { attributLang } from './Temoignages.jsx';

const TEMOIGNAGE = {
  id: 1, nom_affiche: 'Client Test', ville: 'Douala', type_chantier: 'maison',
  texte: '工程质量很好，团队很专业。', note: 5, langue: 'zh', date: '2026-10-01',
};

function api({ realisations = [], demos = [], temoignages = [TEMOIGNAGE], autres = {} } = {}) {
  return simulerApi({
    'GET /api/vitrine/realisations/': reponse(200, page(realisations)),
    'GET /api/vitrine/demos/': reponse(200, page(demos)),
    'GET /api/vitrine/temoignages/': reponse(200, page(temoignages)),
    ...autres,
  });
}

const rendre = () => rendreAvecRoutes('/realisations', { '/realisations': <VitrinePage />, '/connexion': <p>Connexion</p> });

async function remplirEtEnvoyer(u) {
  await u.click(await screen.findByRole('radio', { name: '4 étoiles sur 5' }));
  await u.type(screen.getByLabelText(/Votre témoignage/), 'Un très bon travail, merci à toute l’équipe du CIR.');
  await u.click(screen.getByRole('button', { name: 'Envoyer mon témoignage' }));
}

describe('FormulaireTemoignage', () => {
  it('quota atteint (429) : message du serveur, texte gardé, pas de « merci », pas d’erreur sous les champs', async () => {
    connecterLocalement();
    const fetch = api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, []),
        'POST /api/vitrine/temoignages/': reponse(429, { detail: 'Vous avez atteint la limite de 5 témoignages par jour.' }),
      },
    });
    rendre();
    const u = userEvent.setup();
    await remplirEtEnvoyer(u);
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Vous avez atteint la limite de 5 témoignages par jour.');
    expect(screen.queryByText('Merci pour votre témoignage !')).toBeNull();
    expect(screen.getByLabelText(/Votre témoignage/)).toHaveValue('Un très bon travail, merci à toute l’équipe du CIR.');
    expect(screen.getByLabelText(/Votre témoignage/)).not.toHaveAccessibleDescription(/limite/);
    expect(screen.getByRole('button', { name: 'Envoyer mon témoignage' })).toBeEnabled();
    expect(appels(fetch, 'POST', '/api/vitrine/temoignages/')).toHaveLength(1);
  });

  it('429 sans corps JSON : message par défaut traduit (jamais vide)', async () => {
    connecterLocalement();
    api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, []),
        'POST /api/vitrine/temoignages/': { ok: false, status: 429, headers: { get: () => 'text/html' }, json: async () => null },
      },
    });
    rendre();
    const u = userEvent.setup();
    await remplirEtEnvoyer(u);
    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent.trim().length).toBeGreaterThan(5);
  });

  it('« mes témoignages » : réponse paginée acceptée, liste rechargée après un envoi', async () => {
    connecterLocalement();
    let miens = [];
    const fetch = api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': () => reponse(200, page(miens)),
        'POST /api/vitrine/temoignages/': (corps) => {
          miens = [{ id: 7, texte: corps.texte, note: corps.note, langue: 'fr', statut: 'en_attente' }];
          return reponse(201, { id: 7, ...corps, statut: 'en_attente' });
        },
      },
    });
    rendre();
    const u = userEvent.setup();
    await remplirEtEnvoyer(u);
    expect(await screen.findByText('Merci pour votre témoignage !')).toBeInTheDocument();
    expect(await screen.findByText('Un très bon travail, merci à toute l’équipe du CIR.')).toBeInTheDocument();
    expect(screen.getAllByText('En attente de validation').length).toBeGreaterThan(0);
    const appelsMiens = appels(fetch, 'GET', '/api/vitrine/temoignages/miens/');
    expect(appelsMiens.length).toBeGreaterThanOrEqual(2);
    appelsMiens.forEach(([, init]) => expect(init.headers.Authorization).toBe('Bearer A1'));
  });

  it('« mes témoignages » : le texte du client porte l’attribut lang de sa langue d’écriture', async () => {
    connecterLocalement();
    api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, [
          { id: 5, texte: 'Very good work, thank you to the whole team.', note: 5, langue: 'en', statut: 'publie' },
        ]),
      },
    });
    rendre();
    const texte = await screen.findByText('Very good work, thank you to the whole team.');
    expect(texte.closest('[lang]')).toHaveAttribute('lang', 'en');
  });

  it('visiteur : « mes témoignages » n’est jamais demandé, aucun formulaire affiché', async () => {
    const fetch = api();
    rendre();
    expect(await screen.findByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer mon témoignage' })).toBeNull();
    expect(appels(fetch, 'GET', '/api/vitrine/temoignages/miens/')).toHaveLength(0);
  });
});

describe('Témoignages publiés', () => {
  it('lang du texte : « zh » → « zh-Hans », code inconnu mais valide gardé, valeur douteuse ignorée', () => {
    expect(attributLang('zh')).toBe('zh-Hans');
    expect(attributLang('fr')).toBe('fr');
    expect(attributLang('pt')).toBe('pt');
    expect(attributLang('"><script>')).toBeUndefined();
    expect(attributLang(null)).toBeUndefined();
  });

  it('le texte du client reste dans sa langue quand l’interface change de langue', async () => {
    api();
    rendre();
    const texte = await screen.findByText(TEMOIGNAGE.texte);
    expect(texte.closest('blockquote')).toHaveAttribute('lang', 'zh-Hans');
    await changerLangue('en');
    expect((await screen.findByText(TEMOIGNAGE.texte)).closest('blockquote')).toHaveAttribute('lang', 'zh-Hans');
  });

  it('texte jamais interprété comme du HTML', async () => {
    api({ temoignages: [{ ...TEMOIGNAGE, texte: '<img src=x onerror=alert(1)> Super travail sur notre sol.', langue: 'fr' }] });
    const { container } = rendre();
    expect(await screen.findByText(/Super travail sur notre sol\./)).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('« Voir plus » en erreur : les témoignages restent, message et « Réessayer » reprennent la page 2', async () => {
    let echecs = 1;
    const fetch = api({
      autres: {
        'GET /api/vitrine/temoignages/': (corps, init, url) => {
          if (url.searchParams.get('page') !== '2') return reponse(200, page([TEMOIGNAGE], { count: 2, next: 'p2' }));
          if (echecs-- > 0) return reponse(500, { detail: 'Traceback secret' });
          return reponse(200, page([{ ...TEMOIGNAGE, id: 2, texte: 'Deuxième avis très positif sur le chantier.', langue: 'fr' }], { count: 2 }));
        },
      },
    });
    rendre();
    const u = userEvent.setup();
    await screen.findByText(TEMOIGNAGE.texte);
    const section = screen.getByRole('region', { name: 'Témoignages' });
    await u.click(within(section).getByRole('button', { name: 'Voir plus' }));
    const alerte = await within(section).findByRole('alert');
    expect(alerte).not.toHaveTextContent('Traceback'); // détails techniques d'une 5xx jamais affichés
    expect(screen.getByText(TEMOIGNAGE.texte)).toBeInTheDocument();
    await u.click(within(alerte).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Deuxième avis très positif sur le chantier.')).toBeInTheDocument();
    expect(within(section).queryByRole('alert')).toBeNull();
    expect(within(section).queryByRole('button', { name: 'Voir plus' })).toBeNull();
    const pages = fetch.mock.calls.map(([adresse]) => new URL(adresse))
      .filter((url) => url.pathname === '/api/vitrine/temoignages/').map((url) => url.searchParams.get('page'));
    expect(pages).toEqual([null, '2', '2']);
  });
});

describe('Démonstrations', () => {
  it('lien sans adresse d’intégration : lien externe sûr (nouvel onglet, noopener noreferrer)', async () => {
    api({ demos: [{ id: 1, titre: 'Pose', description: '', video: null, lien: 'https://vimeo.com/1', integration: null, miniature: null, duree: '' }] });
    const { container } = rendre();
    const lien = await screen.findByRole('link', { name: /Pose/ });
    expect(lien).toHaveAttribute('href', 'https://vimeo.com/1');
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien.getAttribute('rel')).toMatch(/noopener/);
    expect(lien.getAttribute('rel')).toMatch(/noreferrer/);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('adresse d’intégration d’un autre site : jamais intégrée, même après un clic', async () => {
    api({ demos: [{ id: 1, titre: 'Piège', description: '', video: null, lien: null, integration: 'https://evil.example/embed/1', miniature: null, duree: '' }] });
    const { container } = rendre();
    await screen.findByText('Piège');
    expect(screen.queryByRole('button', { name: /Piège/ })).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('Vimeo : iframe player.vimeo.com chargée au clic seulement', async () => {
    api({ demos: [{ id: 1, titre: 'Finition', description: '', video: null, lien: 'https://vimeo.com/2', integration: 'https://player.vimeo.com/video/2', miniature: { url: 'https://api.test/media/m.webp', alt: '' }, duree: '' }] });
    const { container } = rendre();
    const bouton = await screen.findByRole('button', { name: 'Lire la vidéo : Finition' });
    expect(container.querySelector('iframe')).toBeNull();
    expect(bouton.querySelector('img')).toHaveAttribute('loading', 'lazy');
    await userEvent.click(bouton);
    expect(container.querySelector('iframe').getAttribute('src')).toMatch(/^https:\/\/player\.vimeo\.com\/video\/2\?/);
  });
});

describe('Requêtes publiques de la vitrine', () => {
  it('client connecté : réalisations, démos et témoignages demandés sans jeton, avec la langue', async () => {
    connecterLocalement();
    const fetch = api({
      autres: {
        'GET /api/comptes/moi/': reponse(200, UTILISATEUR),
        'GET /api/vitrine/temoignages/miens/': reponse(200, []),
      },
    });
    rendre();
    await screen.findByText(TEMOIGNAGE.texte);
    await waitFor(() => expect(appels(fetch, 'GET', '/api/vitrine/demos/').length).toBeGreaterThan(0));
    for (const chemin of ['/api/vitrine/realisations/', '/api/vitrine/demos/', '/api/vitrine/temoignages/']) {
      appels(fetch, 'GET', chemin).forEach(([, init]) => {
        expect(init.headers.Authorization).toBeUndefined();
        expect(init.headers['Accept-Language']).toBe('fr');
      });
    }
  });

  it('changement de langue : réalisations, démos et témoignages redemandés dans la nouvelle langue', async () => {
    const fetch = api();
    rendre();
    await screen.findByText(TEMOIGNAGE.texte);
    await changerLangue('ja');
    for (const chemin of ['/api/vitrine/realisations/', '/api/vitrine/demos/', '/api/vitrine/temoignages/']) {
      await waitFor(() => expect(appels(fetch, 'GET', chemin).map(([, i]) => i.headers['Accept-Language'])).toContain('ja'));
    }
  });
});

describe('lienHttps (corrections)', () => {
  it('seulement https ; javascript:, data:, http:, relatif ou vide refusés', async () => {
    const { lienHttps } = await import('../regles.js');
    expect(lienHttps('https://vimeo.com/1')).toBe('https://vimeo.com/1');
    for (const l of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>x</b>', 'http://vimeo.com/1', '/relatif', '', null, undefined]) {
      expect(lienHttps(l)).toBeNull();
    }
  });

  it('démo avec un lien non https : aucun lien affiché', async () => {
    api({ demos: [{ id: 1, titre: 'Piège lien', description: '', video: null, lien: 'javascript:alert(1)', integration: null, miniature: null, duree: '' }] });
    const { container } = rendre();
    await screen.findByText('Piège lien');
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /Piège lien/ })).toBeNull();
  });
});
