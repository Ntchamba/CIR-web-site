// Zoom entre les pages : la vue transitionnée n'est demandée que pour un changement de chemin absolu.
import { activerZoomEntrePages } from './profondeur.js';
import { simulerMouvementReduit } from '@/test/outils.jsx';

function fauxRouteur(chemin = '/catalogue') {
  const navigate = vi.fn();
  return { navigate, state: { location: { pathname: chemin } } };
}

describe('activerZoomEntrePages', () => {
  const origine = document.startViewTransition;
  beforeEach(() => {
    simulerMouvementReduit(false);
    vi.stubGlobal('CSS', { supports: () => true });
    document.startViewTransition = () => ({});
  });
  afterEach(() => {
    if (origine) document.startViewTransition = origine; else delete document.startViewTransition;
    delete navigator.connection;
  });

  it('nouveau chemin absolu : viewTransition demandé, options conservées', () => {
    const r = fauxRouteur();
    const base = r.navigate;
    activerZoomEntrePages(r).navigate('/contact', { state: { a: 1 } });
    expect(base).toHaveBeenCalledWith('/contact', { state: { a: 1 }, viewTransition: true });
  });

  it('objet { pathname } accepté ; la chaîne de requête et l\'ancre ne comptent pas', () => {
    const r = fauxRouteur('/catalogue');
    const base = r.navigate;
    const routeur = activerZoomEntrePages(r);
    routeur.navigate({ pathname: '/contact' });
    routeur.navigate('/catalogue?usage=maison');
    routeur.navigate('/catalogue#haut');
    expect(base.mock.calls[0][1]).toEqual({ viewTransition: true });
    expect(base.mock.calls[1][1]).toBeUndefined();
    expect(base.mock.calls[2][1]).toBeUndefined();
  });

  it('retour arrière, remplacement, recherche relative, choix explicite : aucune transition imposée', () => {
    const r = fauxRouteur();
    const base = r.navigate;
    const routeur = activerZoomEntrePages(r);
    routeur.navigate(-1);
    routeur.navigate('/contact', { replace: true });
    routeur.navigate('?famille=sols');
    routeur.navigate('relatif');
    routeur.navigate('/contact', { viewTransition: false });
    expect(base).toHaveBeenNthCalledWith(1, -1, undefined);
    expect(base.mock.calls[1][1]).toEqual({ replace: true });
    expect(base.mock.calls[2][1]).toBeUndefined();
    expect(base.mock.calls[3][1]).toBeUndefined();
    expect(base.mock.calls[4][1]).toEqual({ viewTransition: false });
  });

  it.each([
    ['sans API View Transitions', () => { delete document.startViewTransition; }],
    ['mouvement réduit', () => simulerMouvementReduit(true)],
    ['économie de données', () => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })],
  ])('%s : navigation ordinaire', (_, preparer) => {
    preparer();
    const r = fauxRouteur();
    const base = r.navigate;
    activerZoomEntrePages(r).navigate('/contact');
    expect(base.mock.calls[0][1]).toBeUndefined();
  });
});
