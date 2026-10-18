// Devis (équipe) : liste, demandes de rendu (tiroir), éditeur (aperçu par le serveur, erreurs par ligne,
// prix du catalogue seulement s'il existe, envoi avec confirmation, lecture seule hors brouillon).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { erreursLignes, prixCatalogue, versCorps, ligneVide } from './lignes.js';

const COMMANDE = {
  id: 5, reference: 'CIR-2026-0005', surface_m2: '20.00', client: { id: 3, nom_complet: 'Awa Nana' },
  lignes: [{ id: 1, produit: { id: 4, reference: 'YD-500', nom: 'Sol autolissant' }, design: null }],
};
const PRODUITS = page([
  { id: 4, nom: 'Sol autolissant', reference: 'YD-500', prix: '3500', unite_prix: 'kg' },
  { id: 6, nom: 'Vernis', reference: 'V-1', prix: null, unite_prix: 'm2' },
]);
const APERCU = { lignes: [{ quantite_kg: '30.00', montant: '105000' }], total: '105000', complet: true, erreurs: [] };

describe('lignes (aides)', () => {
  it('prix du catalogue seulement s’il existe et correspond au type', () => {
    expect(prixCatalogue({ prix: '3500', unite_prix: 'kg' }, 'materiau')).toEqual({ champ: 'prix_kg', valeur: '3500' });
    expect(prixCatalogue({ prix: null, unite_prix: 'kg' }, 'materiau')).toBeNull();
    expect(prixCatalogue({ prix: '9000', unite_prix: 'm2' }, 'materiau')).toBeNull();
    expect(prixCatalogue({ prix: '9000', unite_prix: 'pose' }, 'surface')).toEqual({ champ: 'prix_m2', valeur: '9000' });
  });
  it('corps : seuls les champs du type, vides omis', () => {
    const l = ligneVide('forfait', { libelle: ' Pose ', montant_forfait: '50 000', prix_kg: '12' });
    expect(versCorps(l)).toEqual({ type_ligne: 'forfait', libelle: 'Pose', montant_forfait: '50000' });
  });
  it('erreurs 400 par ligne (listes imbriquées)', () => {
    const e = { donnees: { lignes: [{}, { libelle: ['Trop long.'] }] } };
    expect(erreursLignes(e).parLigne).toEqual([{}, { libelle: 'Trop long.' }]);
    expect(erreursLignes({ donnees: { lignes: ['Ajoutez une ligne.'] } }).generale).toBe('Ajoutez une ligne.');
  });
});

describe('DevisPage', () => {
  it('liste les devis avec état et commande liée', async () => {
    simulerApi([
      ['GET', 'demandes-rendu/resume/', { nouvelle: 2, en_etude: 0, devis_envoye: 0, close: 0, total: 2 }],
      ['GET', '/api/admin/devis/', page([{ id: 21, reference: 'DEV-2026-0001', commande: 5, commande_reference: 'CIR-2026-0005', etat: 'envoye', expire: true, total: '105000', envoye_le: '2026-10-17T10:00:00Z' }])],
    ]);
    rendre('/devis');
    expect(await screen.findByRole('link', { name: 'DEV-2026-0001' })).toHaveAttribute('href', '/devis/21');
    expect(screen.getByRole('link', { name: 'CIR-2026-0005' })).toHaveAttribute('href', '/commandes/5');
    expect(screen.getByText('Expiré')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /Demandes de rendu\s*2/ })).toBeInTheDocument();
  });

  it('boîte des demandes de rendu : tiroir, réponse, création de devis', async () => {
    const demande = { id: 9, reference: 'REN-2026-0009', description: 'Je voudrais un rendu gris', type_batiment: 'maison', surface_m2: '30.00', etat: 'nouvelle', cree_le: '2026-10-17T10:00:00Z', client: { id: 3, nom_complet: 'Awa Nana', email: 'awa@x.cm', telephone: '690' } };
    const simule = simulerApi([
      ['GET', 'demandes-rendu/resume/', { nouvelle: 1, total: 1 }],
      ['GET', 'demandes-rendu/9/', { ...demande, commande: 5, images: [{ url: 'http://x/a.webp', alt: '' }], devis: [], reponse_equipe: '', notes_internes: '' }],
      ['PATCH', 'demandes-rendu/9/', { ...demande, etat: 'en_etude', reponse_equipe: 'Bien reçu' }],
      ['GET', 'demandes-rendu/', page([demande])],
    ]);
    rendre('/devis?onglet=demandes');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'REN-2026-0009' }));
    const tiroir = await screen.findByRole('dialog');
    expect(await within(tiroir).findByRole('img', { name: 'Image jointe 1' })).toHaveAttribute('src', 'http://x/a.webp');
    expect(within(tiroir).getByRole('link', { name: 'Créer un devis' })).toHaveAttribute('href', '/devis/nouveau?commande=5&demande=9');
    await u.selectOptions(within(tiroir).getByLabelText('État'), 'en_etude');
    await u.type(within(tiroir).getByLabelText("Réponse à l'équipe"), 'Bien reçu');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer la réponse' }));
    await waitFor(() => expect(appels(simule, 'PATCH', 'demandes-rendu/9/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', 'demandes-rendu/9/')[0][1].body)).toEqual({ etat: 'en_etude', reponse_equipe: 'Bien reçu' });
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('EditeurDevis', () => {
  const base = (extra = []) => simulerApi([
    ['GET', '/api/admin/commandes/5/', COMMANDE],
    ['GET', '/api/admin/catalogue/produits/', PRODUITS],
    ...extra,
  ]);

  it('part des lignes de la commande, préremplit le prix du catalogue et demande l’aperçu au serveur', async () => {
    const simule = base([['POST', '/api/admin/devis/calculer/', APERCU]]);
    rendre('/devis/nouveau?commande=5');
    const prix = await screen.findByLabelText('Prix au kg (FCFA)');
    expect(prix).toHaveValue('3500');
    expect(screen.getByLabelText('Surface (m²)')).toHaveValue('20.00');
    await waitFor(() => expect(appels(simule, 'POST', 'calculer')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', 'calculer')[0][1].body)).toEqual({
      lignes: [{ type_ligne: 'materiau', produit: 4, surface_m2: '20.00', prix_kg: '3500' }],
    });
    // Le total affiché vient du serveur.
    expect(await screen.findByText(/105\s000 FCFA/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('30 kg')).toBeInTheDocument();
  });

  it("ne remplit pas de prix quand le produit n'en a pas, et signale les erreurs par ligne", async () => {
    base([['POST', '/api/admin/devis/calculer/', { lignes: [{}], total: '0', complet: false, erreurs: [{ ligne: 0, champ: 'dosage_kg_m2', message: 'Indiquez le dosage.' }] }]]);
    rendre('/devis/nouveau?commande=5');
    const u = userEvent.setup();
    await screen.findByLabelText('Prix au kg (FCFA)');
    await u.click(screen.getByRole('button', { name: 'Ajouter une ligne à la surface' }));
    await u.selectOptions(screen.getAllByLabelText('Produit du catalogue')[1], '6');
    expect(screen.getByLabelText('Prix au m² (FCFA)')).toHaveValue('');
    expect(screen.getByText(/pas de prix de ce type/)).toBeInTheDocument();
    expect((await screen.findAllByText('Indiquez le dosage.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Envoyer au client' })).toBeDisabled();
  });

  it('enregistre un nouveau brouillon (POST) puis affiche les erreurs 400 sous les champs', async () => {
    let n = 0;
    const simule = base([
      ['POST', '/api/admin/devis/calculer/', APERCU],
      ['POST', '/api/admin/devis/', () => (n++ === 0
        ? reponse(400, { validite_jours: ['Trop long.'], lignes: [{ libelle: ['Libellé invalide.'] }] })
        : reponse(201, { id: 30, reference: 'DEV-2026-0030', etat: 'brouillon', lignes: [], commande: 5 }))],
    ]);
    rendre('/devis/nouveau?commande=5&demande=9');
    const u = userEvent.setup();
    await screen.findByLabelText('Prix au kg (FCFA)');
    await u.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Trop long.')).toBeInTheDocument();
    expect(screen.getByText('Libellé invalide.')).toBeInTheDocument();
    const corps = JSON.parse(appels(simule, 'POST', '/api/admin/devis/')[0][1].body);
    expect(corps).toMatchObject({ commande: 5, demande: 9, validite_jours: 30 });
  });

  it("l'envoi demande confirmation, enregistre puis envoie", async () => {
    const brouillon = { id: 30, reference: 'DEV-2026-0030', etat: 'brouillon', commande: 5, validite_jours: 30, notes: '', lignes: [{ ordre: 0, type_ligne: 'materiau', produit: 4, surface_m2: '20.00', dosage_kg_m2: '1.50', prix_kg: '3500', libelle: 'Sol autolissant' }] };
    const simule = base([
      ['GET', '/api/admin/devis/30/', brouillon],
      ['POST', '/api/admin/devis/calculer/', APERCU],
      ['PATCH', '/api/admin/devis/30/', brouillon],
      ['POST', '/api/admin/devis/30/envoyer/', { ...brouillon, etat: 'envoye', total: '105000', lignes: [{ ordre: 0, type_ligne: 'materiau', libelle: 'Sol autolissant', quantite_kg: '30.00', montant: '105000' }] }],
    ]);
    rendre('/devis/30');
    const u = userEvent.setup();
    const bouton = await screen.findByRole('button', { name: 'Envoyer au client' });
    await waitFor(() => expect(bouton).toBeEnabled());
    await u.click(bouton);
    expect(appels(simule, 'POST', 'envoyer')).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: "Confirmer l'envoi" }));
    await waitFor(() => expect(appels(simule, 'POST', 'envoyer')).toHaveLength(1));
    expect(appels(simule, 'PATCH', '/devis/30/')).toHaveLength(1);
    expect(await screen.findByText(/n'est plus un brouillon/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).toBeNull();
  });

  it('lecture seule hors brouillon, sans appel à calculer', async () => {
    const simule = base([['GET', '/api/admin/devis/31/', { id: 31, reference: 'DEV-2026-0031', etat: 'accepte', commande: 5, valide_jusqu_au: '2026-11-16', total: '105000', notes: '', lignes: [{ ordre: 0, type_ligne: 'forfait', libelle: 'Pose', montant: '105000' }] }]]);
    rendre('/devis/31');
    expect(await screen.findByText(/n'est plus un brouillon/)).toBeInTheDocument();
    expect(screen.getByText('Pose')).toBeInTheDocument();
    expect(screen.queryByLabelText('Libellé')).toBeNull();
    expect(appels(simule, 'POST', 'calculer')).toHaveLength(0);
  });

  it('sans commande dans l’adresse : invite à passer par une commande', async () => {
    base();
    rendre('/devis/nouveau');
    expect(await screen.findByRole('heading', { level: 1, name: "Choisissez d'abord une commande" })).toBeInTheDocument();
  });
});
