// Tests (site-testeur) des composants communs (ImageMedia, Paragraphes, VoirPlus) et contrôles de sécurité
// sur tout le code du site : pas de HTML injecté, iframes limitées, liens externes protégés.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ImageMedia from './ImageMedia.jsx';
import Paragraphes from './Paragraphes.jsx';
import VoirPlus from './VoirPlus.jsx';

const sources = import.meta.glob(['/src/**/*.{js,jsx}', '!/src/**/*.test.{js,jsx}', '!/src/test/**'], {
  query: '?raw', import: 'default', eager: true,
});

describe('ImageMedia', () => {
  it('chargement progressif par défaut, dimensions réservées, alt de l’API', () => {
    render(<ImageMedia image={{ url: 'https://api.test/a.webp', alt: 'Sol gris' }} largeur={640} hauteur={480} />);
    const img = screen.getByRole('img', { name: 'Sol gris' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '640');
    expect(img).toHaveAttribute('height', '480');
  });

  it('prioritaire : chargée tout de suite ; alt forcé (vide = décorative) ; rien sans URL', () => {
    const { container, rerender } = render(<ImageMedia image={{ url: 'https://api.test/a.webp', alt: 'x' }} alt="" prioritaire />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('alt', '');
    rerender(<ImageMedia image={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ImageMedia image={{ url: '', alt: 'x' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Paragraphes', () => {
  it('un paragraphe par bloc, HTML affiché comme du texte, attribut lang transmis', () => {
    const { container } = render(<Paragraphes texte={'Premier <b>gras</b>\n\n  \n\n<script>alert(1)</script>Second'} lang="en" />);
    const p = container.querySelectorAll('p');
    expect(p).toHaveLength(2);
    expect(p[0].textContent).toBe('Premier <b>gras</b>');
    expect(container.querySelector('b, script')).toBeNull();
    expect(container.firstChild).toHaveAttribute('lang', 'en');
  });

  it('texte vide : rien', () => {
    const { container } = render(<Paragraphes texte="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VoirPlus', () => {
  const liste = (champs) => ({
    elements: [{ id: 1 }, { id: 2 }], total: 5, suivant: true, chargementSuite: false, erreurSuite: null, voirPlus: vi.fn(), ...champs,
  });

  it('compte affiché (pluriel), bouton « Voir plus »', async () => {
    const l = liste();
    render(<VoirPlus liste={l} />);
    expect(screen.getByText('2 éléments affichés sur 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(l.voirPlus).toHaveBeenCalledTimes(1);
  });

  it('erreur sur la page suivante : message et « Réessayer » qui relance la même action', async () => {
    const l = liste({ erreurSuite: new Error('Connexion impossible.') });
    render(<VoirPlus liste={l} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible.');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(l.voirPlus).toHaveBeenCalledTimes(1);
  });

  it('dernière page : pas de bouton ; liste vide : rien', () => {
    const { container, rerender } = render(<VoirPlus liste={liste({ suivant: false, elements: [{ id: 1 }], total: 1 })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1 élément affiché sur 1')).toBeInTheDocument();
    rerender(<VoirPlus liste={liste({ elements: [] })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('sécurité du code du site', () => {
  const fichiers = Object.entries(sources);

  it('le code source est bien lu', () => {
    expect(fichiers.length).toBeGreaterThan(30);
  });

  it('aucun dangerouslySetInnerHTML ni innerHTML', () => {
    const fautifs = fichiers.filter(([, code]) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(code)).map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it('chaque lien target="_blank" a rel="noopener noreferrer"', () => {
    const fautifs = [];
    fichiers.forEach(([f, code]) => {
      for (const m of code.matchAll(/<[^>]*target="_blank"[^>]*>/gs)) {
        if (!/rel="noopener noreferrer"/.test(m[0])) fautifs.push(`${f}: ${m[0].slice(0, 80)}`);
      }
    });
    expect(fautifs).toEqual([]);
  });

  it('une seule iframe, dont l’adresse passe par adresseIntegration (YouTube sans cookie ou Vimeo)', () => {
    const avecIframe = fichiers.filter(([, code]) => /<iframe/.test(code)).map(([f]) => f);
    expect(avecIframe).toEqual(['/src/modules/vitrine/composants/Demos.jsx']);
    const demos = sources['/src/modules/vitrine/composants/Demos.jsx'];
    expect(demos).toMatch(/adresseIntegration\(demo\.integration\)/);
    expect(demos).toMatch(/<iframe[^>]*src=\{integration\}/s);
  });
});
