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

describe('fichiers de textes du site', () => {
  it.each([['en', en], ['zh', zh], ['de', de], ['ja', ja]])('%s : mêmes clés et variables que le français', (code, textes) => {
    expect(ecartsAvecFrancais(fr, textes)).toEqual([]);
  });
});

describe('changement de langue', () => {
  it('visiteur : toute la page passe en anglais, titre de l’onglet compris, sans appel au compte', async () => {
    const fetch = simulerApi();
    rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Accueil' })).toBeInTheDocument();
    await userEvent.selectOptions(choixEntete(), 'en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/connexion');
    expect(screen.getByText('Our resins are made by our partner Jiuye.')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Home | CIR, epoxy resin floors'));
    expect(document.documentElement.lang).toBe('en');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('japonais et chinois : textes et formulaires traduits', async () => {
    simulerApi();
    rendre('/connexion');
    await screen.findByRole('heading', { level: 1, name: 'Se connecter' });
    await userEvent.selectOptions(choixEntete(), 'ja');
    expect(await screen.findByLabelText(/メールアドレス/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(await screen.findByText('メールアドレスを入力してください。')).toBeInTheDocument();
    await userEvent.selectOptions(choixEntete(), 'zh');
    expect(await screen.findByRole('heading', { level: 1, name: '登录' })).toBeInTheDocument();
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
