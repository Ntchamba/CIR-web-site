// Basculement « à plat » de l'entrée en profondeur (jsdom ne juge pas l'animation : on vérifie les conditions).
import { appliquerProfondeur } from './profondeur.js';
import { deplacerCamera } from './camera.js';
import { simulerMouvementReduit } from '@/test/outils.jsx';

const racine = () => document.createElement('html');
const cssPrisEnCharge = () => vi.stubGlobal('CSS', { supports: () => true });

describe('profondeur', () => {
  afterEach(() => { delete navigator.connection; });

  it('navigateur sans animation liée au défilement : page à plat', () => {
    const r = racine();
    expect(appliquerProfondeur(r)).toBe(false);
    expect(r.hasAttribute('data-plat')).toBe(true);
  });

  it('prise en charge, aucune préférence : profondeur active (pas de data-plat)', () => {
    cssPrisEnCharge();
    simulerMouvementReduit(false);
    const r = racine();
    expect(appliquerProfondeur(r)).toBe(true);
    expect(r.hasAttribute('data-plat')).toBe(false);
  });

  it('prefers-reduced-motion : à plat', () => {
    cssPrisEnCharge();
    simulerMouvementReduit(true);
    const r = racine();
    expect(appliquerProfondeur(r)).toBe(false);
    expect(r.hasAttribute('data-plat')).toBe(true);
  });

  it('économie de données : à plat', () => {
    cssPrisEnCharge();
    simulerMouvementReduit(false);
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    const r = racine();
    expect(appliquerProfondeur(r)).toBe(false);
  });
});

describe('caméra', () => {
  function sceneFactice() {
    const parent = document.createElement('div');
    const scene = document.createElement('div');
    const image = document.createElement('div');
    image.className = 'scene-image';
    image.animate = vi.fn(() => ({ id: 'camera' }));
    scene.append(image);
    parent.append(scene);
    return { scene, image, parent };
  }

  it('sans trajet demandé (mouvement réduit, adresse directe) : cadrage immédiat, aucune animation', () => {
    const { scene, image, parent } = sceneFactice();
    deplacerCamera(scene, { x: 22, y: 42, zoom: 2.2 }, { animer: false, vue: 'catalogue' });
    expect(image.animate).not.toHaveBeenCalled();
    expect(scene.style.getPropertyValue('--cam-zoom')).toBe('2.2');
    expect(scene.style.getPropertyValue('--cam-x')).toBe('22');
    expect(parent.dataset.cam).toBe('catalogue');
  });

  it('avec trajet : une animation de 700 ms avec un « push » au milieu', () => {
    const { scene, image } = sceneFactice();
    deplacerCamera(scene, { x: 22, y: 42, zoom: 2.2 }, { animer: true, vue: 'catalogue' });
    expect(image.animate).toHaveBeenCalledTimes(1);
    const [images, options] = image.animate.mock.calls[0];
    expect(images).toHaveLength(3);
    expect(options.duration).toBe(700);
  });
});
