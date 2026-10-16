// Contenus (testeur) : formats réels de /api/admin/contenus/ (coordonnées au premier niveau, médias en adresse,
// dates des bandeaux en date-heure ISO, produit en id), enregistrement de l'accueil en deux temps (JSON puis
// multipart), retrait d'un média, photos de la sphère (multipart, ordre).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, page, rendre, simulerApi } from '@/test/api-simulee.jsx';

import { modifierAccueil } from '../api.js';
import { versFormulaireAccueil } from '../SectionAccueil.jsx';
import { etatBandeau } from '../useContenus.js';
import { validerBandeau } from './TiroirBandeau.jsx';

// Réponse réelle de GET /api/admin/contenus/accueil/ après la migration de données.
const ACCUEIL_REEL = {
  titre: '', accroche: '', video_fond: null, image_affiche: null, texte_partenaire: '',
  telephones: ['+237 6 99 81 16 35', '+237 6 78 82 93 13', '+237 6 56 43 58 46'], whatsapp: '+237 622 191 931',
  email: '', adresse: 'Total Nkolmbong, Douala', modifie_le: '2026-10-16T11:28:38.172776+01:00', traductions: {},
  langues_incompletes: [],
};
// Bandeau réel : les dates saisies « YYYY-MM-DD » reviennent en date-heure du fuseau Africa/Douala.
const BANDEAU_REEL = {
  id: 1, texte: 'Promo', lien: '/catalogue', actif: true, debut: '2026-10-01T00:00:00+01:00', fin: '2026-10-31T00:00:00+01:00',
  ordre: 0, traductions: {}, langues_incompletes: ['en', 'zh', 'de', 'ja'],
};
const PHOTO_REELLE = (id, ordre, extra = {}) => ({
  id, image: `http://testserver/media/contenus/sphere/${id}.webp`, alt: `Photo ${id}`, produit: null, ordre, traductions: {},
  langues_incompletes: [], ...extra,
});

beforeEach(() => {
  localStorage.setItem('cir-tdb.jetons', JSON.stringify({ acces: 'a', rafraichissement: 'r' }));
});

describe('versFormulaireAccueil', () => {
  it('lit les coordonnées au premier niveau (API équipe)', () => {
    expect(versFormulaireAccueil(ACCUEIL_REEL)).toMatchObject({
      telephones: ACCUEIL_REEL.telephones, whatsapp: '+237 622 191 931', adresse: 'Total Nkolmbong, Douala', email: '',
    });
  });
  it('se replie sur coordonnees.* (forme de l’API publique)', () => {
    const f = versFormulaireAccueil({ titre: 'T', coordonnees: { telephones: ['+237 1'], whatsapp: 'w', email: 'e@x.cm', adresse: 'a' } });
    expect(f).toMatchObject({ telephones: ['+237 1'], whatsapp: 'w', email: 'e@x.cm', adresse: 'a' });
  });
});

describe('modifierAccueil', () => {
  it('textes et retraits en JSON, puis nouveaux fichiers seuls en multipart', async () => {
    const simule = simulerApi([['PATCH', '/api/admin/contenus/accueil/', ACCUEIL_REEL]]);
    const image = new File(['x'], 'affiche.png', { type: 'image/png' });
    await modifierAccueil({ titre: 'T', telephones: ['+237 1'] }, { video_fond: null, image_affiche: image });
    const patchs = appels(simule, 'PATCH', '/api/admin/contenus/accueil/');
    expect(patchs).toHaveLength(2);
    expect(JSON.parse(patchs[0][1].body)).toEqual({ titre: 'T', telephones: ['+237 1'], video_fond: null });
    const fd = patchs[1][1].body;
    expect(fd).toBeInstanceOf(FormData);
    expect([...fd.keys()]).toEqual(['image_affiche']);
  });

  it('sans nouveau fichier : un seul PATCH JSON', async () => {
    const simule = simulerApi([['PATCH', '/contenus/accueil/', ACCUEIL_REEL]]);
    await modifierAccueil({ titre: 'T' }, {});
    expect(appels(simule, 'PATCH', '/contenus/accueil/')).toHaveLength(1);
  });
});

describe('SectionAccueil (format réel)', () => {
  it('affiche les médias renvoyés en adresse et retire la vidéo (video_fond null en JSON)', async () => {
    const avecMedias = {
      ...ACCUEIL_REEL, video_fond: 'http://testserver/media/contenus/fond.mp4', image_affiche: 'http://testserver/media/contenus/a.webp',
    };
    const simule = simulerApi([
      ['GET', '/contenus/accueil/', avecMedias],
      ['PATCH', '/contenus/accueil/', (u, o) => ({ ...avecMedias, ...JSON.parse(o.body) })],
    ]);
    rendre('/contenus');
    const u = userEvent.setup();
    expect(await screen.findByDisplayValue('+237 6 99 81 16 35')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', avecMedias.image_affiche);
    await u.click(screen.getByRole('button', { name: 'Retirer la vidéo' }));
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/contenus/accueil/')).toHaveLength(1));
    const corps = JSON.parse(appels(simule, 'PATCH', '/contenus/accueil/')[0][1].body);
    expect(corps).toMatchObject({ video_fond: null, telephones: ACCUEIL_REEL.telephones, whatsapp: '+237 622 191 931' });
    expect(corps).not.toHaveProperty('image_affiche');
    expect(await screen.findByText('Aucune vidéo')).toBeInTheDocument();
  });

  it("affiche sous le champ l'erreur du serveur sur les téléphones", async () => {
    simulerApi([
      ['GET', '/contenus/accueil/', ACCUEIL_REEL],
      ['PATCH', '/contenus/accueil/', () => Promise.resolve(new Response(
        JSON.stringify({ telephones: ['Numéro de téléphone invalide : abc.'] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ))],
    ]);
    rendre('/contenus');
    const u = userEvent.setup();
    await screen.findByDisplayValue('+237 6 99 81 16 35');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Numéro de téléphone invalide : abc.');
  });

  it('refuse un e-mail invalide avant tout envoi', async () => {
    const simule = simulerApi([['GET', '/contenus/accueil/', ACCUEIL_REEL]]);
    rendre('/contenus');
    const u = userEvent.setup();
    await screen.findByDisplayValue('+237 6 99 81 16 35');
    await u.type(screen.getByLabelText('E-mail'), 'pas-un-email');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription("Cet e-mail n'est pas valide.");
    expect(appels(simule, 'PATCH', '/contenus/accueil/')).toHaveLength(0);
  });
});

describe('Bandeaux (format réel)', () => {
  it('ouvre un bandeau réel : les dates ISO du serveur deviennent YYYY-MM-DD', async () => {
    const simule = simulerApi([
      ['GET', '/contenus/bandeaux/', [BANDEAU_REEL]],
      ['PATCH', '/contenus/bandeaux/1/', (u, o) => ({ ...BANDEAU_REEL, ...JSON.parse(o.body) })],
    ]);
    rendre('/contenus/bandeaux');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Promo' }));
    const tiroir = screen.getByRole('dialog', { name: 'Modifier le bandeau' });
    expect(within(tiroir).getByLabelText('Début (facultatif)')).toHaveValue('2026-10-01');
    expect(within(tiroir).getByLabelText('Fin (facultative)')).toHaveValue('2026-10-31');
    await u.clear(within(tiroir).getByLabelText('Début (facultatif)'));
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/bandeaux/1/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'PATCH', '/bandeaux/1/')[0][1].body))
      .toMatchObject({ debut: null, fin: '2026-10-31', lien: '/catalogue', actif: true });
  });

  it('état d’un bandeau avec les dates réelles du serveur', () => {
    expect(etatBandeau(BANDEAU_REEL, new Date(2026, 8, 30))).toBe('programme');
    expect(etatBandeau(BANDEAU_REEL, new Date(2026, 9, 15))).toBe('actif');
    expect(etatBandeau(BANDEAU_REEL, new Date(2026, 10, 1))).toBe('expire');
    expect(etatBandeau({ ...BANDEAU_REEL, actif: false }, new Date(2026, 9, 15))).toBe('inactif');
  });

  // Back-end (services.bandeaux_actifs) : affiché si debut <= maintenant < fin ; une fin saisie « 2026-10-31 »
  // est enregistrée à 2026-10-31 00:00 (Africa/Douala) : le bandeau n'est donc plus affiché le 31 octobre.
  it('annonce le même état que le site le jour de la fin (« Du 1er au 31 octobre », le 31 à 10 h)', () => {
    const maintenant = new Date('2026-10-31T10:00:00+01:00');
    const afficheParLeSite = new Date(BANDEAU_REEL.debut) <= maintenant && maintenant < new Date(BANDEAU_REEL.fin);
    expect(etatBandeau(BANDEAU_REEL, maintenant) === 'actif').toBe(afficheParLeSite);
  });

  it('refuse un lien « //exemple.cm » (pas un chemin du site)', () => {
    expect(validerBandeau({ texte: 'Promo', lien: '//exemple.cm', debut: '', fin: '' })).toHaveProperty('lien');
    expect(validerBandeau({ texte: 'Promo', lien: '', debut: '2026-10-02', fin: '2026-10-01' })).toHaveProperty('fin');
  });
});

describe('Sphère (format réel)', () => {
  it('ajoute une photo en multipart (produit en id, ordre en fin de liste)', async () => {
    const simule = simulerApi([
      ['GET', '/contenus/sphere/', [PHOTO_REELLE(1, 0)]],
      ['GET', '/catalogue/produits/', page([{ id: 3, nom: 'Sol autolissant' }])],
      ['POST', '/api/admin/contenus/sphere/', PHOTO_REELLE(2, 1, { produit: 3, alt: 'Sol bleu' })],
    ]);
    rendre('/contenus/sphere');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Ajouter une photo' }));
    const tiroir = screen.getByRole('dialog', { name: 'Nouvelle photo' });
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    expect(appels(simule, 'POST', '/contenus/sphere/')).toHaveLength(0); // photo obligatoire
    await u.upload(within(tiroir).getByLabelText(/^Photo/), new File(['x'], 'sol.png', { type: 'image/png' }));
    await u.type(within(tiroir).getByLabelText('Description de la photo'), 'Sol bleu');
    await waitFor(() => expect(within(tiroir).getByRole('option', { name: 'Sol autolissant' })).toBeInTheDocument());
    await u.selectOptions(within(tiroir).getByLabelText(/^Produit lié/), '3');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'POST', '/contenus/sphere/')).toHaveLength(1));
    const fd = appels(simule, 'POST', '/contenus/sphere/')[0][1].body;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('image').name).toBe('sol.png');
    expect(fd.get('produit')).toBe('3');
    expect(fd.get('ordre')).toBe('1');
    expect(fd.get('alt')).toBe('Sol bleu');
    // La carte affiche le nom du produit à partir de son id.
    expect(await screen.findByText('Ouvre : Sol autolissant')).toBeInTheDocument();
  });

  it('modifie une photo sans nouveau fichier : PATCH JSON, produit null', async () => {
    const simule = simulerApi([
      ['GET', '/contenus/sphere/', [PHOTO_REELLE(1, 0, { produit: 3 })]],
      ['GET', '/catalogue/produits/', page([{ id: 3, nom: 'Sol autolissant' }])],
      ['PATCH', '/contenus/sphere/1/', (u, o) => ({ ...PHOTO_REELLE(1, 0), ...JSON.parse(o.body) })],
    ]);
    rendre('/contenus/sphere');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Modifier Photo 1' }));
    const tiroir = screen.getByRole('dialog', { name: 'Modifier la photo' });
    expect(within(tiroir).getByRole('img', { name: 'Aperçu' })).toHaveAttribute('src', 'http://testserver/media/contenus/sphere/1.webp');
    await waitFor(() => expect(within(tiroir).getByLabelText(/^Produit lié/)).toHaveValue('3'));
    await u.selectOptions(within(tiroir).getByLabelText(/^Produit lié/), '');
    await u.click(within(tiroir).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(appels(simule, 'PATCH', '/contenus/sphere/1/')).toHaveLength(1));
    const options = appels(simule, 'PATCH', '/contenus/sphere/1/')[0][1];
    expect(options.body).not.toBeInstanceOf(FormData);
    const corps = JSON.parse(options.body);
    expect(corps).toEqual({ alt: 'Photo 1', traductions: {}, produit: null });
  });

  it("reprend l'ordre renvoyé par POST sphere/ordre/ (liste des photos)", async () => {
    const simule = simulerApi([
      ['GET', '/contenus/sphere/', [PHOTO_REELLE(1, 0), PHOTO_REELLE(2, 1), PHOTO_REELLE(3, 2)]],
      ['POST', '/contenus/sphere/ordre/', [PHOTO_REELLE(1, 0), PHOTO_REELLE(3, 1), PHOTO_REELLE(2, 2)]],
    ]);
    rendre('/contenus/sphere');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Descendre Photo 2' }));
    await waitFor(() => expect(appels(simule, 'POST', '/sphere/ordre/')).toHaveLength(1));
    expect(JSON.parse(appels(simule, 'POST', '/sphere/ordre/')[0][1].body)).toEqual({ ids: [1, 3, 2] });
    await waitFor(() => {
      const liste = screen.getByText('3 photos').nextElementSibling;
      const noms = [...liste.querySelectorAll(':scope > li > strong')].map((el) => el.textContent);
      expect(noms).toEqual(['Photo 1', 'Photo 3', 'Photo 2']);
    });
    expect(screen.getByText('Nouvel ordre enregistré.', { selector: 'p:not([role])' })).toBeInTheDocument();
  });
});
