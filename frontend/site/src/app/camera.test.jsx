// Caméra : pas de fuite (trajet annulé au démontage), reprise depuis la position courante, élément absent,
// aucun trajet au premier affichage ni sous les préférences de mouvement réduit.
import { cadrageDe } from './cameras.js';
import { render } from '@testing-library/react';

import { deplacerCamera, useCamera } from './camera.js';
import { simulerMouvementReduit } from '@/test/outils.jsx';

function Scene({ chemin }) {
  const ref = useCamera(chemin);
  return <div className="page"><div className="scene" ref={ref}><div className="scene-image" /></div></div>;
}

function espionner(image) {
  const animations = [];
  image.animate = vi.fn((cles, options) => {
    const a = { id: options.id, cancel: vi.fn(), cles };
    animations.push(a);
    return a;
  });
  image.getAnimations = () => animations.filter((a) => !a.cancel.mock.calls.length);
  return animations;
}

describe('caméra : crochet useCamera', () => {
  beforeEach(() => {
    simulerMouvementReduit(false);
    vi.stubGlobal('CSS', { supports: () => true });
  });

  it('premier affichage (adresse directe) : cadrage posé, aucun trajet', () => {
    const proto = Element.prototype;
    proto.animate = vi.fn();
    try {
      const { container } = render(<Scene chemin="/catalogue/yd-500" />);
      expect(proto.animate).not.toHaveBeenCalled();
      expect(container.querySelector('.scene').style.getPropertyValue('--cam-zoom')).toBe('3');
      expect(container.querySelector('.page').dataset.cam).toBe('produit');
    } finally {
      delete proto.animate;
    }
  });

  it('changement de page : un trajet ; démontage : trajet annulé', () => {
    const { container, rerender, unmount } = render(<Scene chemin="/" />);
    const image = container.querySelector('.scene-image');
    const animations = espionner(image);
    rerender(<Scene chemin="/catalogue" />);
    expect(animations).toHaveLength(1);
    expect(animations[0].cancel).not.toHaveBeenCalled();
    unmount();
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
  });

  it('second changement en plein trajet : le trajet en cours est annulé, un nouveau part', () => {
    const { container, rerender } = render(<Scene chemin="/" />);
    const animations = espionner(container.querySelector('.scene-image'));
    rerender(<Scene chemin="/catalogue" />);
    rerender(<Scene chemin="/realisations" />);
    expect(animations).toHaveLength(2);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    expect(animations[1].cancel).not.toHaveBeenCalled();
  });

  it('mouvement réduit : cadrage immédiat, aucune animation', () => {
    simulerMouvementReduit(true);
    const { container, rerender } = render(<Scene chemin="/" />);
    const animations = espionner(container.querySelector('.scene-image'));
    rerender(<Scene chemin="/catalogue" />);
    expect(animations).toHaveLength(0);
    expect(container.querySelector('.page').dataset.cam).toBe('catalogue');
    expect(container.querySelector('.scene').style.getPropertyValue('--cam-zoom')).toBe(String(cadrageDe('/catalogue').zoom));
  });

  it('navigateur sans animation liée au défilement : cadrage immédiat', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    const { container, rerender } = render(<Scene chemin="/" />);
    const animations = espionner(container.querySelector('.scene-image'));
    rerender(<Scene chemin="/contact" />);
    expect(animations).toHaveLength(0);
  });
});

describe('caméra : deplacerCamera', () => {
  function scene() {
    const parent = document.createElement('div');
    const s = document.createElement('div');
    const image = document.createElement('div');
    image.className = 'scene-image';
    s.append(image);
    parent.append(s);
    return { s, image, parent };
  }

  it('reprend depuis la position courante lue sur l\'élément (pas depuis l\'ancien cadrage)', () => {
    const { s, image } = scene();
    const animations = espionner(image);
    const lecture = vi.spyOn(window, 'getComputedStyle');
    lecture.mockReturnValueOnce({ transform: 'matrix(1.7, 0, 0, 1.7, -120, 35)', scale: '1.05', transformOrigin: '10px 20px' });
    lecture.mockReturnValue({ transform: 'matrix(2.2, 0, 0, 2.2, 300, 0)', scale: 'none', transformOrigin: '50px 50px' });
    deplacerCamera(s, { x: 22, y: 42, zoom: 2.2 }, { animer: true, vue: 'catalogue' });
    const [debut, milieu, fin] = animations[0].cles;
    expect(debut.transform).toBe('translate(-120px, 35px) scale(1.7)');
    expect(debut.scale).toBe(1.05);
    expect(debut.transformOrigin).toBe('10px 20px');
    expect(fin.transform).toBe('translate(300px, 0px) scale(2.2)');
    expect(milieu.offset).toBe(0.5);
    // « push » du milieu : plus proche que la moyenne
    expect(milieu.transform).toContain('translate(90px, 17.5px)');
  });

  it('annule le trajet précédent (id camera) avant de lire la position et d\'en lancer un autre', () => {
    const { s, image } = scene();
    const ancien = { id: 'camera', cancel: vi.fn() };
    const autre = { id: 'autre', cancel: vi.fn() };
    image.getAnimations = () => [ancien, autre];
    image.animate = vi.fn(() => ({}));
    deplacerCamera(s, { x: 50, y: 50, zoom: 1 }, { animer: true });
    expect(ancien.cancel).toHaveBeenCalled();
    expect(autre.cancel).not.toHaveBeenCalled();
  });

  it('élément de scène absent : aucune erreur, rien n\'est posé', () => {
    const vide = document.createElement('div');
    expect(deplacerCamera(vide, { x: 1, y: 1, zoom: 1 }, { animer: true, vue: 'x' })).toBeNull();
    expect(vide.style.getPropertyValue('--cam-zoom')).toBe('');
  });

  it('navigateur sans element.animate : cadrage posé, aucun trajet, aucune erreur', () => {
    const { s, image, parent } = scene();
    delete image.animate;
    expect(deplacerCamera(s, { x: 20, y: 30, zoom: 2 }, { animer: true, vue: 'devis' })).toBeNull();
    expect(s.style.getPropertyValue('--cam-x')).toBe('20');
    expect(parent.dataset.cam).toBe('devis');
  });
});
