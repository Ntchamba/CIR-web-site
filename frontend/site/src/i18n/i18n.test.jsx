// Multilingue du site : fichiers de textes complets, changement de langue depuis l'en-tête, langue
// gardée dans le compte du client connecté.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { ecartsAvecFrancais } from '@partage/i18n/verification.js';

import App from '@/app/App.jsx';
import { appels, connecterLocalement, reponse, simulerApi, UTILISATEUR } from '@/test/outils.jsx';

import de from './de.js';
import en from './en.js';
import fr from './fr.js';
import ja from './ja.js';
import zh from './zh.js';

function rendre(chemin = '/') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>,
  );
}

const choixEntete = () => within(screen.getByRole('banner')).getByRole('combobox');
// Écran de connexion : ni en-tête ni pied de page (maquette), le choix de la langue est sur le visuel de gauche.
const choixLangue = () => screen.getAllByRole('combobox').find((s) => s.querySelector('option[value="ja"]'));

describe('fichiers de textes du site', () => {
  it.each([['en', en], ['zh', zh], ['de', de], ['ja', ja]])('%s : mêmes clés et variables que le français', (code, textes) => {
    expect(ecartsAvecFrancais(fr, textes)).toEqual([]);
  });
});

describe('changement de langue', () => {
  it('visiteur : toute la page passe en anglais, titre de l’onglet compris, contenus rechargés en anglais', async () => {
    const fetch = simulerApi();
    rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Révélation.' })).toBeInTheDocument();
    await userEvent.selectOptions(choixEntete(), 'en');
    expect(await screen.findByText(/Where lasting floors are born/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/connexion');
    expect(screen.getByText('Jiuye, epoxy resin manufacturer')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('CIR: epoxy resin floor coatings in Douala'));
    expect(document.documentElement.lang).toBe('en');
    // Le contenu de l'API est redemandé dans la nouvelle langue ; aucun appel au compte pour un visiteur.
    await waitFor(() => {
      const langues = appels(fetch, 'GET', '/api/contenus/accueil/').map(([, init]) => init.headers['Accept-Language']);
      expect(langues).toContain('en');
    });
    expect(appels(fetch, 'GET', '/api/comptes/moi/')).toHaveLength(0);
  });

  it('japonais et chinois : textes et formulaires traduits', async () => {
    simulerApi();
    rendre('/connexion');
    await screen.findByRole('heading', { level: 1, name: /Votre sol, révélé/ });
    await userEvent.selectOptions(choixLangue(), 'ja');
    expect(await screen.findByLabelText(/メールアドレス/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(await screen.findByText('メールアドレスを入力してください。')).toBeInTheDocument();
    await userEvent.selectOptions(choixLangue(), 'zh');
    expect(await screen.findByRole('heading', { level: 1, name: /您的地坪，焕然一新/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('aria-current', 'page');
    expect(document.documentElement.lang).toBe('zh-Hans');
  });

  it('client connecté : la langue choisie est enregistrée dans son compte (e-mails dans sa langue)', async () => {
    connecterLocalement();
    const fetch = simulerApi({
      'GET /api/comptes/moi/': reponse(200, { ...UTILISATEUR, langue: 'fr' }),
      'PATCH /api/comptes/moi/': (corps) => reponse(200, { ...UTILISATEUR, ...corps }),
    });
    rendre('/compte');
    await screen.findByRole('heading', { level: 1, name: 'Mon compte' });
    await userEvent.selectOptions(choixEntete(), 'de');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Konto' })).toBeInTheDocument();
    await waitFor(() => expect(appels(fetch, 'PATCH', '/api/comptes/moi/')).toHaveLength(1));
    const [[corps, init]] = appels(fetch, 'PATCH', '/api/comptes/moi/');
    expect(corps).toEqual({ langue: 'de' });
    expect(init.headers['Accept-Language']).toBe('de');
  });
});
