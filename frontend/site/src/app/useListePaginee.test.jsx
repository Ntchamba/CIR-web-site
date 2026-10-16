// Tests (site-testeur) des crochets de données : « Voir plus » (erreur sur la page suivante, reprise, doublons),
// rechargement au changement de langue ou de critères, réponses périmées ignorées, « Réessayer ».
import { act, renderHook, waitFor } from '@testing-library/react';

import { changerLangue } from '@/i18n/index.js';

import useDonnees from './useDonnees.js';
import useListePaginee from './useListePaginee.js';

const pageDe = (ids, next = null, count = ids.length) => ({ count, next, previous: null, results: ids.map((id) => ({ id })) });

/** Promesse contrôlée à la main. */
function differee() {
  let resoudre;
  let rejeter;
  const promesse = new Promise((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  return { promesse, resoudre, rejeter };
}

describe('useListePaginee', () => {
  it('« Voir plus » en erreur : la liste reste, erreurSuite est posée, la reprise charge la même page', async () => {
    const charger = vi.fn(async ({ page }) => {
      if (page === 1) return pageDe([1, 2], 'p2', 4);
      if (charger.mock.calls.filter(([a]) => a.page === 2).length === 1) throw new Error('Réseau coupé');
      return pageDe([3, 4], null, 4);
    });
    const { result } = renderHook(() => useListePaginee(charger, []));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.elements.map((e) => e.id)).toEqual([1, 2]);
    expect(result.current.suivant).toBe(true);

    await act(() => result.current.voirPlus());
    expect(result.current.erreurSuite?.message).toBe('Réseau coupé');
    expect(result.current.elements.map((e) => e.id)).toEqual([1, 2]);
    expect(result.current.page).toBe(1);
    expect(result.current.suivant).toBe(true);
    expect(result.current.chargementSuite).toBe(false);
    expect(result.current.erreur).toBeNull(); // l'erreur de la suite ne remplace pas la liste

    await act(() => result.current.voirPlus());
    expect(charger.mock.calls.map(([a]) => a.page)).toEqual([1, 2, 2]);
    expect(result.current.erreurSuite).toBeNull();
    expect(result.current.elements.map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.suivant).toBe(false);
  });

  it('pas de doublon quand une fiche glisse d’une page à l’autre ; pas d’appel sans page suivante', async () => {
    const charger = vi.fn(async ({ page }) => (page === 1 ? pageDe([1, 2], 'p2', 3) : pageDe([2, 3], null, 3)));
    const { result } = renderHook(() => useListePaginee(charger, []));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await act(() => result.current.voirPlus());
    expect(result.current.elements.map((e) => e.id)).toEqual([1, 2, 3]);
    await act(() => result.current.voirPlus());
    expect(charger).toHaveBeenCalledTimes(2);
  });

  it('changement de langue : la liste repart de la page 1', async () => {
    const charger = vi.fn(async ({ page }) => (page === 1 ? pageDe([1], 'p2', 2) : pageDe([2], null, 2)));
    const { result } = renderHook(() => useListePaginee(charger, []));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    await act(() => result.current.voirPlus());
    expect(result.current.elements).toHaveLength(2);

    await act(() => changerLangue('en'));
    await waitFor(() => expect(charger).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(charger.mock.calls[2][0].page).toBe(1);
    expect(result.current.elements.map((e) => e.id)).toEqual([1]);
    expect(result.current.page).toBe(1);
  });

  it('critères changés pendant un chargement : l’ancienne réponse est ignorée', async () => {
    const lente = differee();
    const charger = vi.fn(({ critere }) => (critere === 'a' ? lente.promesse : Promise.resolve(pageDe([20]))));
    const { result, rerender } = renderHook(({ critere }) => useListePaginee(() => charger({ critere }), [critere]),
      { initialProps: { critere: 'a' } });
    rerender({ critere: 'b' });
    await waitFor(() => expect(result.current.elements.map((e) => e.id)).toEqual([20]));
    await act(async () => lente.resoudre(pageDe([10])));
    expect(result.current.elements.map((e) => e.id)).toEqual([20]);
  });

  it('« Voir plus » d’une ancienne liste : réponse ignorée si les critères ont changé entre-temps', async () => {
    const suite = differee();
    const charger = vi.fn(({ critere, page }) => {
      if (page === 2) return suite.promesse;
      return Promise.resolve(critere === 'a' ? pageDe([1], 'p2', 2) : pageDe([30]));
    });
    const { result, rerender } = renderHook(
      ({ critere }) => useListePaginee(({ page }) => charger({ critere, page }), [critere]),
      { initialProps: { critere: 'a' } },
    );
    await waitFor(() => expect(result.current.chargement).toBe(false));
    let promesse;
    act(() => {
      promesse = result.current.voirPlus();
    });
    rerender({ critere: 'b' });
    await waitFor(() => expect(result.current.elements.map((e) => e.id)).toEqual([30]));
    await act(async () => {
      suite.resoudre(pageDe([2]));
      await promesse;
    });
    expect(result.current.elements.map((e) => e.id)).toEqual([30]);
  });

  it('erreur sur la première page puis « Réessayer »', async () => {
    let echec = true;
    const charger = vi.fn(async () => {
      if (echec) throw new Error('Serveur');
      return pageDe([1]);
    });
    const { result } = renderHook(() => useListePaginee(charger, []));
    await waitFor(() => expect(result.current.erreur?.message).toBe('Serveur'));
    echec = false;
    act(() => result.current.recharger());
    await waitFor(() => expect(result.current.elements).toHaveLength(1));
    expect(result.current.erreur).toBeNull();
  });

  it('liste simple (tableau) acceptée', async () => {
    const { result } = renderHook(() => useListePaginee(async () => [{ id: 1 }, { id: 2 }], []));
    await waitFor(() => expect(result.current.elements).toHaveLength(2));
    expect(result.current.total).toBe(2);
    expect(result.current.suivant).toBe(false);
  });
});

describe('useDonnees', () => {
  it('rechargée au changement de langue ; les données restent visibles pendant le rechargement', async () => {
    const enCours = [];
    const charger = vi.fn(() => {
      const d = differee();
      enCours.push(d);
      return d.promesse;
    });
    const { result } = renderHook(() => useDonnees(charger, []));
    await waitFor(() => expect(enCours).toHaveLength(1));
    await act(async () => enCours[0].resoudre('fr'));
    expect(result.current.donnees).toBe('fr');

    await act(() => changerLangue('en'));
    await waitFor(() => expect(enCours).toHaveLength(2));
    expect(result.current.chargement).toBe(true);
    expect(result.current.donnees).toBe('fr');
    await act(async () => enCours[1].resoudre('en'));
    expect(result.current.donnees).toBe('en');
  });

  it('une requête annulée (AbortError) n’affiche pas d’erreur ; le signal est transmis puis annulé', async () => {
    let signal;
    const charger = vi.fn((options) => {
      ({ signal } = options);
      return new Promise(() => {});
    });
    const { unmount } = renderHook(() => useDonnees(charger, []));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('erreur puis « Réessayer »', async () => {
    let echec = true;
    const { result } = renderHook(() => useDonnees(async () => {
      if (echec) throw new Error('Hors ligne');
      return { ok: 1 };
    }, []));
    await waitFor(() => expect(result.current.erreur?.message).toBe('Hors ligne'));
    echec = false;
    act(() => result.current.recharger());
    await waitFor(() => expect(result.current.donnees).toEqual({ ok: 1 }));
  });
});

describe('useDonnees (corrections) : changement de dépendance', () => {
  it('autre slug : l’ancienne donnée disparaît aussitôt ; langue seule : elle reste', async () => {
    const enCours = [];
    const charger = vi.fn(() => {
      const d = differee();
      enCours.push(d);
      return d.promesse;
    });
    const { result, rerender } = renderHook(({ slug }) => useDonnees(charger, [slug]), { initialProps: { slug: 'a' } });
    await waitFor(() => expect(enCours).toHaveLength(1));
    await act(async () => enCours[0].resoudre('A'));
    expect(result.current.donnees).toBe('A');

    rerender({ slug: 'b' });
    await waitFor(() => expect(enCours).toHaveLength(2));
    expect(result.current.donnees).toBeNull();
    expect(result.current.chargement).toBe(true);
    await act(async () => enCours[1].resoudre('B'));
    expect(result.current.donnees).toBe('B');

    await act(() => changerLangue('en'));
    await waitFor(() => expect(enCours).toHaveLength(3));
    expect(result.current.donnees).toBe('B');
    await act(async () => enCours[2].resoudre('B-en'));

    rerender({ slug: 'c' }); // après un changement de langue, un changement de slug vide toujours
    await waitFor(() => expect(enCours).toHaveLength(4));
    expect(result.current.donnees).toBeNull();
  });
});
