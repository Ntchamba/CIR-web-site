// Tests (site-testeur) des composants de l'accueil : sphère au clavier et en mouvement réduit, vidéo de fond
// (économie de données, absence de vidéo), bandeaux (liens externes ou détournés jamais suivis), textes par défaut.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { changerLangue } from '@/i18n/index.js';
import { simulerMouvementReduit } from '@/test/outils.jsx';

import Bandeaux from './Bandeaux.jsx';
import Hero from './Hero.jsx';
import Partenaire from './Partenaire.jsx';
import Sphere, { positions } from './Sphere.jsx';
import VideoFond from './VideoFond.jsx';

const cssAccueil = readFileSync(resolve(process.cwd(), 'src/modules/accueil/Accueil.module.css'), 'utf8');
const photo = (id, produit = null) => ({ id, image: { url: `https://api.test/media/s${id}.webp`, alt: `Sol ${id}` }, produit });
const avecRouteur = (el) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});

describe('Sphere', () => {
  it('clavier : chaque photo est un lien atteignable avec Tab, nommé, image décorative', async () => {
    const photos = [photo(1, { slug: 'yd-500', nom: 'Sol autolissant' }), photo(2), photo(3), photo(4), photo(5)];
    avecRouteur(<Sphere photos={photos} />);
    const liste = screen.getByRole('list', { name: 'Photos de sols en résine époxy' });
    const liens = within(liste).getAllByRole('link');
    expect(liens).toHaveLength(5);
    liens.forEach((lien) => {
      expect(lien).toHaveAccessibleName();
      expect(lien.querySelector('img')).toHaveAttribute('alt', '');
    });
    const u = userEvent.setup();
    for (const lien of liens) {
      await u.tab();
      expect(lien).toHaveFocus();
    }
    expect(liens[0]).toHaveAttribute('href', '/catalogue/yd-500');
    expect(liens[1]).toHaveAttribute('href', '/catalogue');
  });

  it('la rotation s’arrête au survol et au focus ; pas d’animation en mouvement réduit (CSS)', () => {
    expect(cssAccueil).toMatch(/\.globe:hover,\s*\.globe:focus-within\s*\{\s*animation-play-state:\s*paused/);
    expect(cssAccueil).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.globe\s*\{\s*animation:\s*none/);
  });

  it('mouvement réduit : grille statique, images chargées à la demande', () => {
    simulerMouvementReduit();
    const { container } = avecRouteur(<Sphere photos={[photo(1), photo(2), photo(3), photo(4), photo(5)]} />);
    expect(container.querySelector('[style*="rotateY"]')).toBeNull();
    container.querySelectorAll('img').forEach((img) => expect(img).toHaveAttribute('loading', 'lazy'));
  });

  it('moins de 4 photos : grille ; photos sans image ignorées ; aucune photo → rien (pas de photo inventée)', () => {
    const { container, rerender } = avecRouteur(<Sphere photos={[photo(1), { id: 2, image: null }, photo(3)]} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(container.querySelector('[style*="rotateY"]')).toBeNull();
    rerender(<MemoryRouter><Sphere photos={[]} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('libellés traduits au changement de langue', async () => {
    avecRouteur(<Sphere photos={[photo(1, { slug: 'yd-500', nom: 'YD-500' }), photo(2), photo(3), photo(4)]} />);
    await changerLangue('en');
    expect(await screen.findByRole('list', { name: /./ })).not.toHaveAccessibleName('Photos de sols en résine époxy');
  });

  it('positions : une place par photo, aucun rayon inférieur à 200 px sur l’anneau central', () => {
    for (const n of [1, 4, 8, 9, 13, 30]) {
      const p = positions(n);
      expect(p).toHaveLength(n);
      expect(p.every((x) => Number.isFinite(x.angle) && Number.isFinite(x.y))).toBe(true);
      expect(Math.max(...p.filter((x) => x.y === 0).map((x) => x.rayon))).toBeGreaterThanOrEqual(200);
    }
  });
});

describe('VideoFond', () => {
  afterEach(() => {
    delete globalThis.navigator.connection;
  });

  it('économie de données : affiche seule, la vidéo n’est pas chargée', () => {
    Object.defineProperty(globalThis.navigator, 'connection', { value: { saveData: true }, configurable: true });
    render(<VideoFond video="https://api.test/media/fond.mp4" affiche={{ url: 'https://api.test/media/a.webp', alt: '' }} />);
    expect(screen.queryByTestId('video-fond')).toBeNull();
    expect(screen.getByTestId('affiche-fond')).toHaveAttribute('alt', '');
  });

  it('vidéo décorative : sans son, jouée une fois (pas de boucle), hors du parcours clavier', () => {
    render(<VideoFond video="https://api.test/media/fond.mp4" affiche={null} />);
    const video = screen.getByTestId('video-fond');
    expect(video.muted).toBe(true);
    expect(video).not.toHaveAttribute('loop');
    expect(video).not.toHaveAttribute('controls');
    expect(video).toHaveAttribute('aria-hidden', 'true');
    expect(video).toHaveAttribute('tabindex', '-1');
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('lecture refusée par le navigateur : aucune erreur', () => {
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    expect(() => render(<VideoFond video="https://api.test/media/fond.mp4" />)).not.toThrow();
  });

  it('ni vidéo ni affiche : rien', () => {
    const { container } = render(<VideoFond video={null} affiche={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Bandeaux', () => {
  it('seuls les chemins internes deviennent des liens (pas d’adresse externe, « // », « \\ » ni javascript:)', () => {
    avecRouteur(<Bandeaux bandeaux={[
      { id: 1, texte: 'Interne', lien: '/catalogue?usage=maison' },
      { id: 2, texte: 'Externe', lien: 'https://exemple.com' },
      { id: 3, texte: 'Protocole relatif', lien: '//exemple.com' },
      { id: 4, texte: 'Barre oblique inverse', lien: '/\\exemple.com' },
      { id: 5, texte: 'Script', lien: 'javascript:alert(1)' },
      { id: 6, texte: 'Sans lien', lien: '' },
      { id: 7, texte: '', lien: '/vide' },
    ]} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Interne' })).toHaveAttribute('href', '/catalogue?usage=maison');
    ['Externe', 'Protocole relatif', 'Barre oblique inverse', 'Script', 'Sans lien'].forEach((texte) => {
      expect(screen.getByText(texte).tagName).toBe('SPAN');
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(6); // bandeau sans texte ignoré
  });

  it('texte saisi par l’équipe affiché tel quel (jamais interprété comme du HTML)', () => {
    const { container } = avecRouteur(<Bandeaux bandeaux={[{ id: 1, texte: '<img src=x onerror=alert(1)>', lien: '' }]} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});

describe('Hero et Partenaire', () => {
  it('textes par défaut traduits si l’équipe n’a rien saisi, dans la langue choisie', async () => {
    await changerLangue('de');
    avecRouteur(<><Hero contenu={{ titre: '', accroche: '' }} /><Partenaire texte="" /></>);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).not.toBe('');
    expect(h1).not.toHaveTextContent('Des sols en résine époxy faits pour durer');
    expect(screen.getByRole('img', { name: 'Jiuye' })).toBeInTheDocument(); // nom propre jamais traduit
  });
});
