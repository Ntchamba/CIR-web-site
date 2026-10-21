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
import Sphere, { ANNEAUX_ORDINATEUR, ANNEAUX_TELEPHONE, repartir } from './Sphere.jsx';
import VideoFond from './VideoFond.jsx';

const cssAccueil = readFileSync(resolve(process.cwd(), 'src/modules/accueil/Accueil.module.css'), 'utf8');
const photo = (id, produit = null) => ({ id, image: { url: `https://api.test/media/s${id}.webp`, alt: `Sol ${id}` }, produit });
const avecRouteur = (el) => render(<MemoryRouter>{el}</MemoryRouter>);

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});

describe('Sphere', () => {
  it('clavier : une seule étape de tabulation par photo (les photos répétées pour remplir la sphère sont ignorées), nommée, image décorative', async () => {
    const photos = [photo(1, { slug: 'yd-500', nom: 'Sol autolissant' }), photo(2), photo(3), photo(4), photo(5)];
    avecRouteur(<Sphere photos={photos} />);
    const groupe = screen.getByRole('group', { name: 'Photos de sols en résine époxy' });
    const liens = within(groupe).getAllByRole('link'); // les doublons sont masqués (aria-hidden)
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

  it('mouvement réduit : sphère immobile (même géométrie), images chargées à la demande, pas de bouton pause', () => {
    simulerMouvementReduit();
    const { container } = avecRouteur(<Sphere photos={[photo(1), photo(2), photo(3), photo(4), photo(5)]} />);
    expect(container.querySelector('[style*="rotateY"]')).not.toBeNull();
    expect(container.querySelector('[style*="animation: none"]')).not.toBeNull();
    container.querySelectorAll('img').forEach((img) => expect(img).toHaveAttribute('loading', 'lazy'));
    expect(screen.queryByRole('button')).toBeNull();
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
    expect(await screen.findByRole('group', { name: /./ })).not.toHaveAccessibleName('Photos de sols en résine époxy');
  });

  it('géométrie des maquettes : 6 + 8 + 6 photos sur ordinateur, 6 + 12 + 6 sur téléphone, photos reprises en boucle', () => {
    const photos = Array.from({ length: 9 }, (_, i) => photo(i + 1));
    const ordi = repartir(photos, ANNEAUX_ORDINATEUR);
    expect(ordi.map((a) => a.tuiles.length)).toEqual([6, 8, 6]);
    expect(ordi.map((a) => a.rayon)).toEqual([235, 315, 235]);
    expect(ordi.map((a) => a.y)).toEqual([-215, 0, 215]);
    const tel = repartir(photos, ANNEAUX_TELEPHONE);
    expect(tel.map((a) => a.tuiles.length)).toEqual([6, 12, 6]);
    // chaque photo apparaît (9 emplacements « uniques », les autres sont des doublons)
    const toutes = ordi.flatMap((a) => a.tuiles);
    expect(toutes).toHaveLength(20);
    expect(toutes.filter((x) => !x.doublon)).toHaveLength(9);
    expect(new Set(toutes.map((x) => x.photo.id)).size).toBe(9);
    // les anneaux sont régulièrement espacés
    expect(ordi[1].tuiles.map((x) => x.angle)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
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

describe('Hero', () => {
  it('textes par défaut traduits si l’équipe n’a rien saisi, dans la langue choisie', async () => {
    await changerLangue('de');
    avecRouteur(<Hero contenu={{ titre: '', accroche: '' }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Révélation.');
    expect(screen.getByText(/Hier entstehen langlebige Böden/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Katalog/ })).toHaveAttribute('href', '/catalogue');
  });

  it('maquette : « Révélation. » avec point corail, accroche, « Voir le catalogue » et « Découvrir »', () => {
    avecRouteur(<Hero contenu={{}} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Révélation.');
    expect(h1.querySelector('i')).toHaveTextContent('.');
    expect(screen.getByText("Là où naissent les sols durables : la résine époxy pour la maison, l'industrie et l'entreprise.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le catalogue' })).toHaveAttribute('href', '/catalogue');
    expect(screen.getByRole('link', { name: /Découvrir/ })).toHaveAttribute('href', '#salles');
  });
});

describe('Sphere (corrections) : pause', () => {
  const cinq = () => [photo(1), photo(2), photo(3), photo(4), photo(5)];

  it('bouton Pause / Lecture traduit, aria-pressed, placé après la sphère dans l’ordre du clavier', async () => {
    const { container } = avecRouteur(<Sphere photos={cinq()} />);
    const u = userEvent.setup();
    const bouton = screen.getByRole('button', { name: 'Mettre en pause la sphère' });
    expect(bouton).toHaveAttribute('aria-pressed', 'false');
    const globe = screen.getByRole('group');
    expect(globe.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(globe).not.toHaveClass('globeArrete');
    await u.click(bouton);
    expect(screen.getByRole('button', { name: 'Relancer la sphère' })).toHaveAttribute('aria-pressed', 'true');
    expect(globe).toHaveClass('globeArrete');
    await u.click(bouton);
    expect(bouton).toHaveAttribute('aria-pressed', 'false');
    expect(globe).not.toHaveClass('globeArrete');
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('libellé du bouton dans la langue choisie', async () => {
    await changerLangue('en');
    avecRouteur(<Sphere photos={cinq()} />);
    expect(await screen.findByRole('button', { name: 'Pause the sphere' })).toBeInTheDocument();
  });

  it('CSS : pause par la classe, la photo survolée grandit, faces arrière visibles comme dans les maquettes', () => {
    expect(cssAccueil).toMatch(/\.globeArrete\s*\{\s*animation-play-state:\s*paused/);
    expect(cssAccueil).toMatch(/\.tuile:hover img[^{]*\{\s*scale:\s*1\.25/);
    expect(cssAccueil).not.toMatch(/backface-visibility:\s*hidden/);
  });
});

describe('Bandeaux (corrections) : espaces refusés', () => {
  it('tabulation, retour à la ligne, espace : jamais un lien', () => {
    avecRouteur(<Bandeaux bandeaux={[
      { id: 1, texte: 'Tab', lien: '/\t/exemple.com' },
      { id: 2, texte: 'Ligne', lien: '/\n/exemple.com' },
      { id: 3, texte: 'Espace', lien: '/ /exemple.com' },
      { id: 4, texte: 'Bon', lien: '/realisations?type=maison' },
    ]} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Bon' })).toHaveAttribute('href', '/realisations?type=maison');
  });
});

describe('Hero (corrections) : pas de texte par défaut remplacé', () => {
  it('contenus pas encore reçus : titre et accroche masqués mais présents ; prêts : visibles', () => {
    const { rerender } = avecRouteur(<Hero contenu={{}} pret={false} />);
    const h1 = screen.getByRole('heading', { level: 1, hidden: true });
    expect(h1).toHaveClass('enAttente');
    expect(cssAccueil).toMatch(/\.enAttente\s*\{\s*visibility:\s*hidden/);
    rerender(<MemoryRouter><Hero contenu={{ titre: 'Titre équipe' }} pret /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Titre équipe' })).not.toHaveClass('enAttente');
  });
});
