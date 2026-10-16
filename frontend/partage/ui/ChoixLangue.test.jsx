// Tests du choix de la langue : liste accessible, langues écrites dans leur langue, changement appliqué.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { langueCourante, reinitialiserI18n } from '../i18n/i18n.js';
import ChoixLangue from './ChoixLangue.jsx';
import MessageErreur from './MessageErreur.jsx';

afterEach(() => reinitialiserI18n());

describe('ChoixLangue', () => {
  it('liste nommée, cinq langues avec leur attribut lang, français sélectionné', () => {
    render(<ChoixLangue />);
    const liste = screen.getByRole('combobox', { name: 'Choisir la langue' });
    expect(liste).toHaveValue('fr');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Français', 'English', '中文', 'Deutsch', '日本語']);
    expect(options[2]).toHaveAttribute('lang', 'zh-Hans');
  });

  it('change la langue, redessine les textes et prévient le parent', async () => {
    const surChangement = vi.fn();
    render(<><ChoixLangue surChangement={surChangement} /><MessageErreur erreur="x" reessayer={() => {}} /></>);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'de');
    await waitFor(() => expect(surChangement).toHaveBeenCalledWith('de'));
    expect(langueCourante()).toBe('de');
    expect(screen.getByRole('combobox', { name: 'Sprache wählen' })).toHaveValue('de');
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('de');
  });
});
