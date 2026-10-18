// Composants communs de la vague 2 (testeur) : Onglets, ConfirmerAction, NotesInternes, LiensContact, useCriteres.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';

import { ErreurApi } from '@partage/api/client.js';

import ConfirmerAction from './ConfirmerAction.jsx';
import LiensContact from './LiensContact.jsx';
import NotesInternes from './NotesInternes.jsx';
import Onglets from './Onglets.jsx';
import { useCriteres } from './useCriteres.js';

function OngletsTest({ surChoix = () => {} }) {
  const [actif, setActif] = useState('nouvelle');
  return (
    <Onglets libelle="Étapes" idBase="test" actif={actif} surChoix={(c) => { setActif(c); surChoix(c); }}
      onglets={[
        { cle: 'nouvelle', libelle: 'Nouvelle', nombre: 3, urgent: true },
        { cle: 'travaux', libelle: 'Travaux', nombre: 0 },
        { cle: 'terminee', libelle: 'Terminée' },
      ]}>
      <p>contenu</p>
    </Onglets>
  );
}

describe('Onglets', () => {
  it('rôles ARIA : un seul onglet tabulable, panneau relié à l’onglet actif, nombres dans le nom', () => {
    render(<OngletsTest />);
    const liste = screen.getByRole('tablist', { name: 'Étapes' });
    const onglets = within(liste).getAllByRole('tab');
    expect(onglets.map((o) => o.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(onglets[0]).toHaveAttribute('aria-selected', 'true');
    expect(onglets[0]).toHaveAccessibleName(/Nouvelle\s*3/);
    const panneau = screen.getByRole('tabpanel');
    expect(panneau).toHaveAttribute('aria-labelledby', onglets[0].id);
    expect(onglets[0]).toHaveAttribute('aria-controls', panneau.id);
  });

  it('flèches, Début et Fin déplacent le focus et le choix, avec rebouclage', async () => {
    const surChoix = vi.fn();
    render(<OngletsTest surChoix={surChoix} />);
    const u = userEvent.setup();
    screen.getAllByRole('tab')[0].focus();
    await u.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Terminée/ })).toHaveFocus();
    await u.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Nouvelle/ })).toHaveFocus();
    await u.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Terminée/ })).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /Nouvelle/ })).toHaveFocus();
    expect(surChoix).toHaveBeenLastCalledWith('nouvelle');
  });
});

describe('ConfirmerAction', () => {
  const rendre = (surConfirmation, extra = {}) => render(
    <ConfirmerAction libelle="Annuler la commande" question="Annuler cette commande ?" libelleConfirmer="Confirmer"
      champ={{ libelle: 'Motif', nom: 'motif' }} surConfirmation={surConfirmation} {...extra} />,
  );

  it('rien ne part avant la confirmation ; le texte est nettoyé ; le bloc se referme après succès', async () => {
    const surConfirmation = vi.fn().mockResolvedValue();
    rendre(surConfirmation);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Annuler la commande' }));
    expect(surConfirmation).not.toHaveBeenCalled();
    await u.type(screen.getByLabelText('Motif'), '  doublon  ');
    await u.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(surConfirmation).toHaveBeenCalledWith('doublon');
    await waitFor(() => expect(screen.queryByRole('group')).toBeNull());
  });

  it('une erreur du serveur reste dans le bloc (alerte) et permet de réessayer', async () => {
    const surConfirmation = vi.fn()
      .mockRejectedValueOnce(new ErreurApi(400, { detail: 'Transition refusée.' }))
      .mockResolvedValueOnce();
    rendre(surConfirmation);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Annuler la commande' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Transition refusée.');
    expect(screen.getByRole('group', { name: 'Annuler cette commande ?' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(surConfirmation).toHaveBeenCalledTimes(2));
  });

  it('désactivée : le bouton ne s’ouvre pas', async () => {
    rendre(vi.fn(), { desactive: true });
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toBeDisabled();
  });

  it('Annuler referme sans appeler le serveur et rend le focus au bouton', async () => {
    const surConfirmation = vi.fn();
    rendre(surConfirmation);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Annuler la commande' }));
    await u.click(within(screen.getByRole('group')).getByRole('button', { name: 'Annuler' }));
    expect(surConfirmation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toHaveFocus();
  });
});

describe('NotesInternes', () => {
  it('désactivé tant que rien n’a changé ; une erreur 400 s’affiche sous le champ ; le bouton se rend à la réussite', async () => {
    const surEnregistrement = vi.fn()
      .mockRejectedValueOnce(new ErreurApi(400, { notes_internes: ['Texte trop long.'] }))
      .mockResolvedValueOnce();
    render(<NotesInternes valeur="RAS" surEnregistrement={surEnregistrement} />);
    const u = userEvent.setup();
    const bouton = screen.getByRole('button', { name: 'Enregistrer les notes' });
    expect(bouton).toBeDisabled();
    await u.type(screen.getByLabelText('Notes'), ' !');
    expect(bouton).toBeEnabled();
    await u.click(bouton);
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription(/Texte trop long/));
    await u.click(bouton);
    expect(await screen.findByText('Notes enregistrées.', { selector: 'p' })).toBeInTheDocument();
    expect(surEnregistrement).toHaveBeenLastCalledWith('RAS !');
    expect(bouton).toBeDisabled();
  });

  it('avertit que les notes ne sont jamais visibles du client', () => {
    render(<NotesInternes valeur="" surEnregistrement={vi.fn()} />);
    expect(screen.getByText(/client/i, { selector: 'p' })).toBeInTheDocument();
  });

  it('ne perd pas la saisie en cours quand la valeur du serveur est rechargée', async () => {
    const { rerender } = render(<NotesInternes valeur="A" surEnregistrement={vi.fn()} />);
    await userEvent.setup().type(screen.getByLabelText('Notes'), 'B');
    rerender(<NotesInternes valeur="A" surEnregistrement={vi.fn()} />);
    expect(screen.getByLabelText('Notes')).toHaveValue('AB');
    rerender(<NotesInternes valeur="Z" surEnregistrement={vi.fn()} />);
    expect(screen.getByLabelText('Notes')).toHaveValue('AB');
  });
});

describe('LiensContact', () => {
  it('nettoie le numéro dans le lien tel: et garde le texte lisible', () => {
    render(<LiensContact telephone="+237 6 77-00 (11) 22" email="a@b.cm" />);
    expect(screen.getByRole('link', { name: '+237 6 77-00 (11) 22' })).toHaveAttribute('href', 'tel:+237677001122');
    expect(screen.getByRole('link', { name: 'a@b.cm' })).toHaveAttribute('href', 'mailto:a@b.cm');
  });

  it('tiret quand il n’y a aucune coordonnée', () => {
    render(<LiensContact email="" telephone="" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

function Criteres() {
  const { valeurs, page, modifier } = useCriteres(['etat', 'q']);
  const { search } = useLocation();
  return (
    <div>
      <output data-testid="adresse">{search}</output>
      <output data-testid="page">{page}</output>
      <output data-testid="etat">{valeurs.etat}</output>
      <button type="button" onClick={() => modifier({ page: 3 })}>page 3</button>
      <button type="button" onClick={() => modifier({ etat: 'travaux' })}>travaux</button>
      <button type="button" onClick={() => modifier({ etat: '' })}>vider</button>
    </div>
  );
}

describe('useCriteres', () => {
  it('garde les critères dans l’adresse, revient à la page 1 quand un critère change et retire les valeurs vides', async () => {
    render(<MemoryRouter initialEntries={['/commandes?etat=nouvelle&q=awa&page=2']}><Criteres /></MemoryRouter>);
    const u = userEvent.setup();
    expect(screen.getByTestId('page')).toHaveTextContent('2');
    await u.click(screen.getByRole('button', { name: 'travaux' }));
    expect(screen.getByTestId('adresse')).toHaveTextContent('?etat=travaux&q=awa');
    expect(screen.getByTestId('page')).toHaveTextContent('1');
    await u.click(screen.getByRole('button', { name: 'page 3' }));
    expect(screen.getByTestId('page')).toHaveTextContent('3');
    await u.click(screen.getByRole('button', { name: 'vider' }));
    expect(screen.getByTestId('adresse')).toHaveTextContent('?q=awa');
  });

  it('une page invalide dans l’adresse vaut 1', () => {
    render(<MemoryRouter initialEntries={['/x?page=abc']}><Criteres /></MemoryRouter>);
    expect(screen.getByTestId('page')).toHaveTextContent('1');
  });
});
