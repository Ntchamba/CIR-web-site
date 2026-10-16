// Composants du tableau de bord (testeur) : accessibilité du Tiroir et des onglets de langues, ChampImage
// (retrait, vidéo), envoi JSON / multipart, répartition des erreurs 400.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

import { ErreurApi } from '@partage/api/client.js';

import { appels, simulerApi } from '@/test/api-simulee.jsx';

import ChampImage, { TYPES_VIDEOS } from './ChampImage.jsx';
import { envoyer, identifiants, repartirErreur, versFormData } from './envoi.js';
import { AUTRES_LANGUES } from './langues.js';
import OngletsLangues from './OngletsLangues.jsx';
import Tiroir from './Tiroir.jsx';

function TiroirTest() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)}>Ouvrir</button>
      <Tiroir ouvert={ouvert} titre="Fiche" sousTitre="YD-500" surFermeture={() => setOuvert(false)}
        pied={<button type="button">Enregistrer</button>}>
        <input aria-label="Premier" />
        <button type="button" disabled>Inactif</button>
      </Tiroir>
    </>
  );
}

describe('Tiroir (accessibilité)', () => {
  it('Maj+Tab depuis le premier élément va au dernier ; le voile ferme ; le défilement de la page est rendu', async () => {
    const u = userEvent.setup();
    render(<TiroirTest />);
    await u.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialogue = screen.getByRole('dialog', { name: 'Fiche' });
    expect(document.body.style.overflow).toBe('hidden');
    // Le focus va au premier champ, pas au bouton « Fermer ».
    expect(screen.getByLabelText('Premier')).toHaveFocus();
    within(dialogue).getByRole('button', { name: 'Fermer' }).focus();
    await u.tab({ shift: true });
    expect(within(dialogue).getByRole('button', { name: 'Enregistrer' })).toHaveFocus();
    await u.tab();
    expect(within(dialogue).getByRole('button', { name: 'Fermer' })).toHaveFocus();
    // Le voile (masqué aux lecteurs d'écran) ferme le panneau.
    fireEvent.click(document.querySelector('[aria-hidden="true"]'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus();
  });

  it('le bouton Fermer est nommé et ferme le panneau', async () => {
    const u = userEvent.setup();
    render(<TiroirTest />);
    await u.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.getByText('YD-500')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ne rend rien quand il est fermé', () => {
    render(<Tiroir ouvert={false} titre="X" surFermeture={() => {}}><p>contenu</p></Tiroir>);
    expect(screen.queryByText('contenu')).toBeNull();
  });
});

function Onglets() {
  const [form, setForm] = useState({ nom: 'Sol', description: '', traductions: {} });
  return (
    <OngletsLangues champs={[{ nom: 'nom', libelle: 'Nom', required: true }, { nom: 'description', libelle: 'Description', multiligne: true }]}
      valeurs={form} traductions={form.traductions}
      surChangement={(c, v) => setForm((f) => ({ ...f, [c]: v }))}
      surTraductions={(traductions) => setForm((f) => ({ ...f, traductions }))} />
  );
}

describe('OngletsLangues (clavier, rôles, langue des champs)', () => {
  it('flèche gauche depuis le français boucle sur le japonais ; Début et Fin ; un seul onglet tabulable', async () => {
    const u = userEvent.setup();
    render(<Onglets />);
    const onglets = screen.getAllByRole('tab');
    expect(onglets.map((o) => o.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
    expect(onglets[0]).toHaveAccessibleName(/Français.*\(obligatoire\)/);
    onglets[0].focus();
    await u.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /日本語/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /日本語/ })).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{Home}');
    expect(onglets[0]).toHaveFocus();
    await u.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /日本語/ })).toHaveFocus();
    // Le panneau est relié à l'onglet actif ; les champs portent la langue saisie.
    const panneau = screen.getByRole('tabpanel');
    expect(panneau).toHaveAccessibleName(/日本語/);
    expect(within(panneau).getByLabelText('Nom (日本語)')).toHaveAttribute('lang', 'ja');
  });

  it('autres langues facultatives : un champ français vide ne rend aucune langue incomplète', async () => {
    render(<Onglets />);
    // « Sol » rempli, description vide : seules les traductions du nom manquent.
    AUTRES_LANGUES.forEach((code) => expect(screen.getAllByRole('tab')
      .find((o) => o.id.endsWith(`-onglet-${code}`))).toHaveAccessibleName(/traduction à compléter/));
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: /Deutsch/ }));
    await u.type(screen.getByLabelText('Nom (Deutsch)'), 'Boden');
    expect(screen.getByRole('tab', { name: /Deutsch/ })).not.toHaveAccessibleName(/à compléter/);
    expect(screen.getByLabelText('Description (Deutsch)')).toHaveAccessibleDescription("Le texte français n'est pas encore saisi.");
  });
});

describe('ChampImage', () => {
  it('propose « Retirer » pour une image existante seulement si le retrait est permis', async () => {
    const surRetrait = vi.fn();
    const { rerender } = render(<ChampImage libelle="Photo" image="http://testserver/media/a.webp" surChoix={() => {}} />);
    expect(screen.getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', 'http://testserver/media/a.webp');
    expect(screen.queryByRole('button', { name: "Retirer l'image" })).toBeNull();
    expect(screen.getByText("Remplacer l'image")).toBeInTheDocument();
    rerender(<ChampImage libelle="Photo" image={{ url: 'http://testserver/media/b.webp', alt: '' }} surChoix={() => {}} surRetrait={surRetrait} />);
    expect(screen.getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', 'http://testserver/media/b.webp');
    await userEvent.setup().click(screen.getByRole('button', { name: "Retirer l'image" }));
    expect(surRetrait).toHaveBeenCalled();
  });

  it('variante vidéo : types MP4 / WebM, plafond indiqué, champ obligatoire signalé', () => {
    render(<ChampImage video libelle="Vidéo" tailleMaxMo={30} surChoix={() => {}} required />);
    const entree = screen.getByLabelText(/^Vidéo/);
    expect(entree).toHaveAttribute('accept', TYPES_VIDEOS);
    expect(TYPES_VIDEOS).toBe('video/mp4,video/webm');
    expect(entree).toHaveAttribute('aria-required', 'true');
    expect(entree).toHaveAccessibleDescription('MP4 ou WebM, 30 Mo au plus.');
    expect(screen.getByText('Aucune vidéo')).toBeInTheDocument();
  });
});

describe('envoi.js', () => {
  beforeEach(() => {
    localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
  });

  it('JSON quand aucun fichier : un retrait de fichier part en null', async () => {
    const simule = simulerApi([['PATCH', '/x/1/', { id: 1 }]]);
    await envoyer('/api/admin/x/1/', { titre: 'A' }, { methode: 'PATCH', fichiers: { image: null, video: undefined } });
    const options = appels(simule, 'PATCH', '/x/1/')[0][1];
    expect(JSON.parse(options.body)).toEqual({ titre: 'A', image: null });
  });

  it('multipart dès qu’un fichier est choisi : retrait en chaîne vide, undefined omis', async () => {
    const simule = simulerApi([['POST', '/x/', { id: 1 }]]);
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    await envoyer('/api/admin/x/', { titre: 'A', date: null, inutile: undefined, produits: [1, 2] }, { fichiers: { image: f, miniature: null } });
    const fd = appels(simule, 'POST', '/x/')[0][1].body;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('date')).toBe('');
    expect(fd.has('inutile')).toBe(false);
    expect(fd.get('produits')).toBe('[1,2]');
    expect(fd.get('miniature')).toBe('');
    expect(fd.get('image').name).toBe('a.png');
  });

  it('versFormData : booléens et nombres en texte', () => {
    const fd = versFormData({ publie: false, ordre: 0 });
    expect(fd.get('publie')).toBe('false');
    expect(fd.get('ordre')).toBe('0');
  });

  it('repartirErreur : erreurs sous les champs connus, sinon erreur générale', () => {
    const erreurChamp = new ErreurApi(400, { reference: ['Un produit porte déjà cette référence.'] });
    expect(repartirErreur(erreurChamp, ['reference'])).toEqual({
      champs: { reference: 'Un produit porte déjà cette référence.' }, generale: null,
    });
    const erreurDetail = new ErreurApi(400, { detail: 'Cette famille contient des produits.' });
    const r = repartirErreur(erreurDetail, ['nom']);
    expect(r.champs).toEqual({});
    expect(r.generale).toBe(erreurDetail);
  });

  it('identifiants : ids ou objets { id }', () => {
    expect(identifiants([1, { id: 2 }])).toEqual([1, 2]);
    expect(identifiants(null)).toEqual([]);
  });
});
