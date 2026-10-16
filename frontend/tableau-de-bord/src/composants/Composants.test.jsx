// Composants propres au tableau de bord : Tiroir, OngletsLangues, ChampImage, BoutonSupprimer, outils.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

import BoutonSupprimer from './BoutonSupprimer.jsx';
import ChampImage from './ChampImage.jsx';
import { lirePrix, versFormData } from './envoi.js';
import { languesIncompletes, modifierTraduction } from './langues.js';
import OngletsLangues from './OngletsLangues.jsx';
import Tiroir from './Tiroir.jsx';

describe('outils multilingues et envoi', () => {
  it('calcule les langues incomplètes comme le serveur', () => {
    const objet = { nom: 'Sol', description: '', traductions: { en: { nom: 'Floor' } } };
    expect(languesIncompletes(objet, ['nom', 'description'])).toEqual(['zh', 'de', 'ja']);
    expect(languesIncompletes({ nom: '', traductions: {} }, ['nom'])).toEqual([]);
  });

  it('retire les textes et les langues vides', () => {
    expect(modifierTraduction({ en: { nom: 'A' } }, 'en', 'nom', ' ')).toEqual({});
    expect(modifierTraduction({}, 'de', 'nom', 'Boden')).toEqual({ de: { nom: 'Boden' } });
  });

  it('lit un prix facultatif sans jamais en inventer', () => {
    expect(lirePrix('')).toBeNull();
    expect(lirePrix('12 500')).toBe(12500);
    expect(lirePrix('12,5')).toBeNaN();
  });

  it('met les objets en chaînes JSON dans un envoi multipart', () => {
    const fichier = new File(['x'], 'photo.png', { type: 'image/png' });
    const fd = versFormData({ traductions: { en: { nom: 'A' } }, produit: null, publie: true }, { image: fichier });
    expect(fd.get('traductions')).toBe('{"en":{"nom":"A"}}');
    expect(fd.get('produit')).toBe('');
    expect(fd.get('publie')).toBe('true');
    expect(fd.get('image').name).toBe('photo.png');
  });
});

function TiroirTest() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)}>Ouvrir</button>
      <Tiroir ouvert={ouvert} titre="Fiche" surFermeture={() => setOuvert(false)}>
        <input aria-label="Premier" />
        <button type="button">Dernier</button>
      </Tiroir>
    </>
  );
}

describe('Tiroir', () => {
  it('piège le focus, se ferme avec Échap et rend le focus', async () => {
    const u = userEvent.setup();
    render(<TiroirTest />);
    await u.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialogue = screen.getByRole('dialog', { name: 'Fiche' });
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Premier')).toHaveFocus();
    await u.tab();
    expect(screen.getByRole('button', { name: 'Dernier' })).toHaveFocus();
    await u.tab(); // retour au début : bouton « Fermer »
    expect(within(dialogue).getByRole('button', { name: 'Fermer' })).toHaveFocus();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus();
  });
});

function OngletsTest({ erreurs }) {
  const [form, setForm] = useState({ nom: 'Sol époxy', traductions: {} });
  return (
    <OngletsLangues champs={[{ nom: 'nom', libelle: 'Nom', required: true }]} valeurs={form}
      traductions={form.traductions} erreurs={erreurs}
      surChangement={(c, v) => setForm((f) => ({ ...f, [c]: v }))}
      surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))} />
  );
}

describe('OngletsLangues', () => {
  it('propose cinq onglets, signale les langues à compléter et édite les traductions', async () => {
    const u = userEvent.setup();
    render(<OngletsTest />);
    const onglets = screen.getAllByRole('tab');
    expect(onglets).toHaveLength(5);
    expect(onglets[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /English.*traduction à compléter/ })).toBeInTheDocument();
    await u.click(screen.getByRole('tab', { name: /English/ }));
    const champ = screen.getByLabelText('Nom (English)');
    expect(champ).toHaveAccessibleDescription('Français : Sol époxy');
    await u.type(champ, 'Epoxy floor');
    expect(screen.getByRole('tab', { name: /English/ })).not.toHaveTextContent('traduction à compléter');
    // Navigation au clavier entre les onglets.
    await u.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /中文/ })).toHaveFocus();
  });

  it("revient sur le français quand le serveur signale une erreur", () => {
    render(<OngletsTest erreurs={{ nom: 'Ce nom existe déjà.' }} />);
    expect(screen.getByLabelText(/^Nom/)).toHaveAccessibleDescription('Ce nom existe déjà.');
  });
});

describe('ChampImage', () => {
  it("transmet le fichier choisi, refuse un fichier trop lourd et affiche l'erreur du serveur", async () => {
    const u = userEvent.setup();
    const surChoix = vi.fn();
    const { rerender } = render(<ChampImage libelle="Photo" surChoix={surChoix} tailleMaxMo={1} />);
    const entree = screen.getByLabelText('Photo');
    const lourd = new File([new Uint8Array(2 * 1024 * 1024)], 'lourd.png', { type: 'image/png' });
    await u.upload(entree, lourd);
    expect(surChoix).not.toHaveBeenCalled();
    expect(entree).toHaveAccessibleDescription(/Ce fichier dépasse 1 Mo/);
    const leger = new File(['x'], 'ok.png', { type: 'image/png' });
    await u.upload(entree, leger);
    expect(surChoix).toHaveBeenCalledWith(leger);
    rerender(<ChampImage libelle="Photo" surChoix={surChoix} fichier={leger} erreur="Image illisible." />);
    expect(screen.getByText('Fichier choisi : ok.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Photo')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('BoutonSupprimer', () => {
  it("demande une confirmation et affiche l'erreur du serveur", async () => {
    const u = userEvent.setup();
    const surConfirmation = vi.fn().mockRejectedValueOnce(new Error('Famille utilisée.'));
    render(<BoutonSupprimer nom="Primaires" surConfirmation={surConfirmation} />);
    await u.click(screen.getByRole('button', { name: 'Supprimer Primaires' }));
    expect(surConfirmation).not.toHaveBeenCalled();
    const groupe = screen.getByRole('group', { name: 'Confirmer la suppression de Primaires' });
    await u.click(within(groupe).getByRole('button', { name: 'Confirmer la suppression' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Famille utilisée.');
    await u.click(within(groupe).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Supprimer Primaires' })).toHaveFocus();
  });
});
