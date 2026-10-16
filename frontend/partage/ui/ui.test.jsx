// Tests des composants de base partagés (accessibilité comprise).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErreurApi } from '../api/client.js';
import * as ui from './index.js';
import { Bouton, Champ, Chargement, EtatVide, Icone, MessageErreur, NOMS_ICONES } from './index.js';

describe('index', () => {
  it('exporte tous les composants', () => {
    ['Bouton', 'Champ', 'Chargement', 'EtatVide', 'Icone', 'MessageErreur'].forEach((nom) => {
      expect(typeof ui[nom]).toBe('function');
    });
    expect(NOMS_ICONES).toContain('compte');
  });
});

describe('Bouton', () => {
  it('est un <button type="button"> avec les classes de variante et de taille', async () => {
    const clic = vi.fn();
    render(<Bouton variante="contour" taille="large" className="perso" onClick={clic}>Envoyer</Bouton>);
    const bouton = screen.getByRole('button', { name: 'Envoyer' });
    expect(bouton).toHaveAttribute('type', 'button');
    expect(bouton.className).toContain('bouton');
    expect(bouton.className).toContain('contour');
    expect(bouton.className).toContain('large');
    expect(bouton.className).toContain('perso');
    await userEvent.click(bouton);
    expect(clic).toHaveBeenCalledTimes(1);
  });

  it('variante plein par défaut ; type="submit" respecté', () => {
    render(<Bouton type="submit">OK</Bouton>);
    const bouton = screen.getByRole('button', { name: 'OK' });
    expect(bouton).toHaveAttribute('type', 'submit');
    expect(bouton.className).toContain('plein');
  });

  it('chargement : désactivé et aria-busy, sans clic possible', async () => {
    const clic = vi.fn();
    render(<Bouton chargement onClick={clic}>Patientez</Bouton>);
    const bouton = screen.getByRole('button', { name: 'Patientez' });
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(bouton);
    expect(clic).not.toHaveBeenCalled();
  });

  it('disabled sans chargement : pas d’aria-busy', () => {
    render(<Bouton disabled>Non</Bouton>);
    const bouton = screen.getByRole('button', { name: 'Non' });
    expect(bouton).toBeDisabled();
    expect(bouton).not.toHaveAttribute('aria-busy');
  });

  it('as="a" : un lien, sans type ni disabled', () => {
    render(<Bouton as="a" href="tel:+237699811635">Appeler</Bouton>);
    const lien = screen.getByRole('link', { name: 'Appeler' });
    expect(lien).toHaveAttribute('href', 'tel:+237699811635');
    expect(lien).not.toHaveAttribute('type');
  });

  it('as={Composant} : transmet les props', () => {
    const Lien = ({ to, ...props }) => <a href={to} {...props} />;
    render(<Bouton as={Lien} to="/catalogue" variante="texte">Catalogue</Bouton>);
    expect(screen.getByRole('link', { name: 'Catalogue' })).toHaveAttribute('href', '/catalogue');
  });
});

describe('Champ', () => {
  it('libellé relié à la saisie, obligatoire signalé', async () => {
    const changer = vi.fn();
    render(<Champ libelle="E-mail" name="email" type="email" required onChange={changer} value="" />);
    const saisie = screen.getByLabelText(/E-mail/);
    expect(saisie.tagName).toBe('INPUT');
    expect(saisie).toHaveAttribute('type', 'email');
    expect(saisie).toBeRequired();
    expect(saisie).not.toHaveAttribute('aria-invalid');
    expect(saisie).not.toHaveAttribute('aria-describedby');
    await userEvent.type(saisie, 'a');
    expect(changer).toHaveBeenCalled();
  });

  it('aide et erreur reliées par aria-describedby, aria-invalid', () => {
    render(<Champ libelle="Ville" id="ville" aide="Ex. Douala" erreur="Indiquez votre ville." />);
    const saisie = screen.getByLabelText('Ville');
    expect(saisie).toHaveAttribute('aria-invalid', 'true');
    expect(saisie).toHaveAttribute('aria-describedby', 'ville-aide ville-erreur');
    expect(saisie).toHaveAccessibleDescription('Ex. Douala Indiquez votre ville.');
    expect(screen.getByText('Indiquez votre ville.')).toHaveAttribute('id', 'ville-erreur');
  });

  it('options : liste déroulante', () => {
    render(<Champ libelle="Unité" options={[['m2', 'Mètre carré'], ['kg', 'Kilogramme']]} defaultValue="kg" />);
    const liste = screen.getByLabelText('Unité');
    expect(liste.tagName).toBe('SELECT');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(liste).toHaveValue('kg');
  });

  it('multiligne : zone de texte', () => {
    render(<Champ libelle="Message" multiligne />);
    expect(screen.getByLabelText('Message').tagName).toBe('TEXTAREA');
  });

  it('identifiants uniques pour deux champs sans id', () => {
    render(<><Champ libelle="Un" /><Champ libelle="Deux" /></>);
    expect(screen.getByLabelText('Un').id).not.toBe(screen.getByLabelText('Deux').id);
  });
});

describe('Chargement', () => {
  it('annoncé par role="status", texte par défaut et personnalisé', () => {
    const { rerender } = render(<Chargement />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    rerender(<Chargement plein texte="Vérification…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Vérification…');
    expect(screen.getByRole('status').className).toContain('chargementPlein');
  });
});

describe('EtatVide', () => {
  it('titre h2 par défaut, texte et action', () => {
    render(<EtatVide titre="Aucune commande" action={<button type="button">Commander</button>}>Rien ici.</EtatVide>);
    expect(screen.getByRole('heading', { level: 2, name: 'Aucune commande' })).toBeInTheDocument();
    expect(screen.getByText('Rien ici.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commander' })).toBeInTheDocument();
  });

  it('niveau de titre réglable, pas de paragraphe vide', () => {
    const { container } = render(<EtatVide titre="Introuvable" niveau={1} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Introuvable' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('MessageErreur', () => {
  it('rien si pas d’erreur', () => {
    const { container } = render(<MessageErreur erreur={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('texte simple annoncé par role="alert"', () => {
    render(<MessageErreur erreur="Oups." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Oups.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ErreurApi : message lisible et bouton « Réessayer »', async () => {
    const reessayer = vi.fn();
    render(<MessageErreur erreur={new ErreurApi(0)} reessayer={reessayer} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Connexion au serveur impossible/);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(reessayer).toHaveBeenCalledTimes(1);
  });

  it('objet sans message : texte par défaut', () => {
    render(<MessageErreur erreur={{}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue. Réessayez.');
  });

  it('pas d’injection HTML (XSS)', () => {
    const { container } = render(<MessageErreur erreur={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('<img src=x onerror="alert(1)">');
  });
});

describe('Icone', () => {
  it('SVG décoratif, taille réglable', () => {
    const { container } = render(<Icone nom="tel" taille={30} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('width', '30');
    expect(svg.querySelector('path').getAttribute('d')).not.toBe('');
  });

  it('nom inconnu : tracé vide sans erreur', () => {
    const { container } = render(<Icone nom="inexistante" />);
    expect(container.querySelector('path').getAttribute('d')).toBe('');
  });

  it('chaque icône a un tracé', () => {
    NOMS_ICONES.forEach((nom) => {
      const { container, unmount } = render(<Icone nom={nom} />);
      expect(container.querySelector('path').getAttribute('d')).toBeTruthy();
      unmount();
    });
  });
});
