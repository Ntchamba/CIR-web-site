// Statistiques (équipe) : périodes, cartes, « À traiter », graphique SVG et son tableau pour les lecteurs d'écran,
// sommes absentes pour un membre simple, période invalide, état vide, accueil branché sur statistiques/resume/.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appels, rendre, reponse, simulerApi } from '@/test/api-simulee.jsx';

import { aujourdhui, calculerPeriode, erreurPeriode } from './periode.js';

const A_TRAITER = {
  commandes_nouvelles: 3, propositions_en_attente_equipe: 2, devis_a_envoyer: 1, demandes_rendu: 0, demandes_contact: 4,
  messages_non_lus: 5, appels_manques: 0, paiements_anomalies: 1,
};
const RESUME = {
  periode: { du: '2026-09-21', au: '2026-10-20' },
  commandes: {
    total: 12, par_etape: { nouvelle: 3, negociation: 2, contrat_signe: 2, travaux: 2, terminee: 2, annulee: 1 },
    par_type_batiment: { maison: 7, industrie: 3, entreprise: 2 }, nouvelles: 4, signees: 6, taux_signature: 0.5, delai_moyen_signature_jours: 3.5,
  },
  a_traiter: A_TRAITER,
  montants: null,
  top_produits: [{ produit_nom: 'Sol autolissant', produit_reference: 'YD-500', commandes: 5 }, { produit_nom: 'Primaire', produit_reference: 'YD-103', commandes: 1 }],
};
const MONTANTS = { chiffre_convenu: 3200000, encaisse: 1500000, reste_a_encaisser: 1700000, nombre_paiements: 6, panier_moyen: 533333 };
const mois = (n, f) => Array.from({ length: n }, (_, i) => ({ mois: `${i < 3 ? 2025 : 2026}-${String(((i + 9) % 12) + 1).padStart(2, '0')}`, ...f(i) }));
const EVOLUTION = { mois: mois(12, (i) => ({ commandes: i, signees: Math.floor(i / 2), encaisse: null })) };

const routes = (resume = RESUME, evolution = EVOLUTION) => [
  ['GET', '/api/admin/statistiques/evolution/', evolution],
  ['GET', '/api/admin/statistiques/resume/', resume],
];

describe('périodes', () => {
  const maintenant = new Date('2026-10-20T10:00:00Z');
  it('calcule les jours à l’heure de Douala', () => {
    expect(aujourdhui(new Date('2026-10-19T23:30:00Z'))).toBe('2026-10-20'); // 00 h 30 à Douala
    expect(calculerPeriode('7j', {}, maintenant)).toEqual({ du: '2026-10-14', au: '2026-10-20' });
    expect(calculerPeriode('30j', {}, maintenant)).toEqual({ du: '2026-09-21', au: '2026-10-20' });
    expect(calculerPeriode('mois', {}, maintenant)).toEqual({ du: '2026-10-01', au: '2026-10-20' });
    expect(calculerPeriode('12m', {}, maintenant)).toEqual({ du: '2025-11-01', au: '2026-10-20' });
    expect(calculerPeriode('12m', {}, new Date('2026-01-05T10:00:00Z'))).toEqual({ du: '2025-02-01', au: '2026-01-05' });
  });
  it('refuse les périodes incomplètes, inversées, impossibles ou trop longues', () => {
    expect(erreurPeriode({ du: '', au: '2026-10-01' })).toBe('incomplete');
    expect(erreurPeriode({ du: '2026-02-31', au: '2026-10-01' })).toBe('invalide');
    expect(erreurPeriode({ du: '2026-10-02', au: '2026-10-01' })).toBe('ordre');
    expect(erreurPeriode({ du: '2025-10-19', au: '2026-10-20' })).toBe('longue');
    expect(erreurPeriode({ du: '2025-10-20', au: '2026-10-20' })).toBeNull();
    expect(erreurPeriode({ du: '2026-10-01', au: '2026-10-01' })).toBeNull();
  });
});

describe('StatistiquesPage', () => {
  it('membre simple : volumes et rien d’autre, aucune somme ni carte d’argent', async () => {
    const simule = simulerApi(routes());
    rendre('/statistiques');
    expect(await screen.findByRole('heading', { level: 1, name: 'Statistiques' })).toBeInTheDocument();
    const indicateurs = await screen.findByText('Contrats signés', { selector: 'dt' });
    expect(indicateurs).toBeInTheDocument();
    expect(screen.getByText('Taux de signature').nextSibling).toHaveTextContent('50 %');
    expect(screen.getByText('Délai moyen de signature').nextSibling).toHaveTextContent('3,5 j');
    expect(screen.queryByText('Chiffre convenu')).toBeNull();
    expect(screen.queryByText('Encaissé')).toBeNull();
    expect(screen.queryByText('Reste à encaisser')).toBeNull();
    expect(document.body.textContent).not.toMatch(/FCFA/);
    // La période par défaut est envoyée explicitement : 30 jours.
    const url = String(appels(simule, 'GET', '/statistiques/resume/')[0][0]);
    expect(url).toMatch(/du=\d{4}-\d{2}-\d{2}&au=\d{4}-\d{2}-\d{2}/);
  });

  it('super-administrateur : cartes d’argent et graphique des encaissements', async () => {
    const evolution = { mois: mois(12, (i) => ({ commandes: i, signees: 1, encaisse: i * 100000 })) };
    simulerApi(routes({ ...RESUME, montants: MONTANTS }, evolution));
    rendre('/statistiques');
    expect(await screen.findByText('Chiffre convenu')).toBeInTheDocument();
    expect(screen.getByText('Chiffre convenu').nextSibling).toHaveTextContent(/3\s200\s000 FCFA/);
    expect(screen.getByText('Encaissé').nextSibling).toHaveTextContent(/1\s500\s000 FCFA/);
    expect(screen.getByText('Reste à encaisser').nextSibling).toHaveTextContent(/1\s700\s000 FCFA/);
    expect(screen.getByRole('img', { name: /montants encaissés/ })).toBeInTheDocument();
  });

  it('« À traiter » : un lien par rubrique vers l’écran concerné', async () => {
    simulerApi(routes());
    rendre('/statistiques');
    const bloc = (await screen.findByRole('heading', { level: 2, name: 'À traiter' })).closest('section');
    expect(within(bloc).getByRole('link', { name: /Nouvelles commandes\s*3/ })).toHaveAttribute('href', '/commandes?etat=nouvelle');
    expect(within(bloc).getByRole('link', { name: /Propositions à traiter\s*2/ })).toHaveAttribute('href', '/commandes?action=1');
    expect(within(bloc).getByRole('link', { name: /Demandes de contact\s*4/ })).toHaveAttribute('href', '/contact?etat=nouvelle');
    expect(within(bloc).getByRole('link', { name: /Messages non lus\s*5/ })).toHaveAttribute('href', '/messagerie?non_lus=1');
    expect(within(bloc).getByRole('link', { name: /Paiements à vérifier\s*1/ })).toHaveAttribute('href', '/paiements?etat=anomalie');
    expect(within(bloc).getByRole('link', { name: /Demandes de rendu\s*0/ })).toHaveAttribute('href', '/devis?onglet=demandes');
  });

  it('graphique : image décrite par un tableau équivalent masqué visuellement, avec toutes les valeurs', async () => {
    simulerApi(routes());
    rendre('/statistiques');
    const graphique = await screen.findByRole('img', { name: /nombre de commandes et de contrats signés/ });
    expect(graphique.tagName.toLowerCase()).toBe('svg');
    const tableau = document.getElementById(graphique.getAttribute('aria-describedby'));
    expect(tableau).not.toBeNull();
    expect(tableau.tagName.toLowerCase()).toBe('table');
    expect(tableau).toHaveClass('visuellement-cache');
    const t = within(tableau);
    expect(t.getByRole('columnheader', { name: 'Mois' })).toBeInTheDocument();
    expect(t.getByRole('columnheader', { name: 'Commandes' })).toBeInTheDocument();
    expect(t.getByRole('columnheader', { name: 'Contrats signés' })).toBeInTheDocument();
    expect(t.getAllByRole('row')).toHaveLength(13);
    expect(t.getByRole('rowheader', { name: /septembre 2026/ })).toBeInTheDocument();
    const derniere = t.getAllByRole('row').at(-1);
    expect(within(derniere).getAllByRole('cell').map((c) => c.textContent)).toEqual(['11', '5']);
    // Pas de graphique d'argent sans sommes.
    expect(screen.queryByRole('img', { name: /montants encaissés/ })).toBeNull();
    // Les barres : une par valeur non nulle.
    expect(graphique.querySelectorAll('rect').length).toBeGreaterThan(10);
  });

  it('respecte prefers-reduced-motion : l’animation des barres n’existe que sous « no-preference »', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(`${process.cwd()}/src/modules/statistiques/Statistiques.module.css`, 'utf8');
    const animations = [...css.matchAll(/animation\s*:/g)];
    expect(animations).toHaveLength(1);
    expect(css.slice(0, animations[0].index)).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*\{[^}]*$/s);
  });

  it('répartition par étape et par type, top produits', async () => {
    simulerApi(routes());
    rendre('/statistiques');
    const etapes = (await screen.findByRole('heading', { level: 2, name: 'Commandes par étape' })).closest('section');
    expect(within(etapes).getByText('Nouvelle').nextSibling.nextSibling).toHaveTextContent('3');
    const types = screen.getByRole('heading', { level: 2, name: 'Commandes par type de bâtiment' }).closest('section');
    expect(within(types).getByText('Maison').nextSibling.nextSibling).toHaveTextContent('7');
    const section = screen.getByRole('heading', { level: 2, name: 'Produits les plus commandés' }).closest('section');
    const items = within(section).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Sol autolissant');
    expect(items[0]).toHaveTextContent('YD-500');
    expect(items[0]).toHaveTextContent('5 commandes');
    expect(items[1]).toHaveTextContent('1 commande');
  });

  it('état vide clair, sans données inventées', async () => {
    simulerApi(routes(
      { ...RESUME, commandes: { ...RESUME.commandes, total: 0, par_etape: {}, par_type_batiment: {}, nouvelles: 0, signees: 0, taux_signature: null, delai_moyen_signature_jours: null }, top_produits: [], a_traiter: Object.fromEntries(Object.keys(A_TRAITER).map((k) => [k, 0])) },
      { mois: mois(12, () => ({ commandes: 0, signees: 0, encaisse: null })) },
    ));
    rendre('/statistiques');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aucune commande sur cette période' })).toBeInTheDocument();
    expect(screen.getByText('Taux de signature').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Délai moyen de signature').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Aucune commande sur les 12 derniers mois.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Commandes par étape' })).toBeNull();
    expect(screen.getByText('Aucun produit commandé sur cette période.')).toBeInTheDocument();
  });

  it('change de période : 7 jours, puis dates libres valides', async () => {
    const simule = simulerApi(routes());
    rendre('/statistiques');
    const u = userEvent.setup();
    await screen.findByText('Contrats signés', { selector: 'dt' });
    expect(screen.getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: '7 jours' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '7 jours' })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(appels(simule, 'GET', '/statistiques/resume/')).toHaveLength(2));
    await u.click(screen.getByRole('button', { name: 'Dates libres' }));
    const du = await screen.findByLabelText('Du');
    await u.clear(du); await u.type(du, '2026-08-01');
    const au = screen.getByLabelText('Au');
    await u.clear(au); await u.type(au, '2026-08-31');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(simule.mock.calls.some(([x]) => String(x).includes('du=2026-08-01&au=2026-08-31'))).toBe(true));
  });

  it('période invalide : message clair et aucune requête envoyée au serveur', async () => {
    const simule = simulerApi(routes());
    rendre('/statistiques?p=libre&du=2026-10-10&au=2026-10-01');
    expect(await screen.findByRole('alert')).toHaveTextContent('La date de début doit précéder la date de fin.');
    expect(appels(simule, 'GET', '/statistiques/resume/')).toHaveLength(0);
    // Plus de 366 jours.
    const u = userEvent.setup();
    const du = screen.getByLabelText('Du');
    await u.clear(du); await u.type(du, '2024-01-01');
    const au = screen.getByLabelText('Au');
    await u.clear(au); await u.type(au, '2026-01-01');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(await screen.findByText('La période ne peut pas dépasser 366 jours.')).toBeInTheDocument();
    expect(appels(simule, 'GET', '/statistiques/resume/')).toHaveLength(0);
  });

  it('erreur 400 du serveur affichée, avec « Réessayer »', async () => {
    simulerApi([
      ['GET', '/api/admin/statistiques/evolution/', EVOLUTION],
      ['GET', '/api/admin/statistiques/resume/', () => reponse(400, { detail: 'Période trop longue.' })],
    ]);
    rendre('/statistiques');
    expect(await screen.findByText('Période trop longue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('accueil branché sur statistiques/resume/', () => {
  it('affiche les indicateurs et les rubriques non vides de « À traiter »', async () => {
    const simule = simulerApi([['GET', '/api/admin/statistiques/resume/', { ...RESUME, montants: MONTANTS }]]);
    rendre('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Aperçu des 30 derniers jours' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Nouvelles commandes\s*3/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Appels manqués/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Voir toutes les statistiques' })).toHaveAttribute('href', '/statistiques');
    expect(screen.getByText('Encaissé').nextSibling).toHaveTextContent(/1\s500\s000 FCFA/);
    // Raccourcis conservés.
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    expect(appels(simule, 'GET', '/statistiques/resume/')[0][0]).toMatch(/resume\/$/);
  });

  it('reste l’accueil d’avant (bienvenue, raccourcis) si les statistiques ne répondent pas', async () => {
    simulerApi([['GET', '/api/admin/statistiques/resume/', () => reponse(500, { detail: 'boom' })]]);
    rendre('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Statistiques' }).every((l) => l.getAttribute('href') === '/statistiques')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Aperçu/ })).toBeNull());
  });
});
