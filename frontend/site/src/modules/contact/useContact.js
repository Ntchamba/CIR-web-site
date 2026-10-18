// Demandes du client connecté : demandes de contact et demandes de rendu (listes paginées, rechargées à la langue).
import useListePaginee from '@/app/useListePaginee.js';
import * as devis from '@/modules/devis/api.js';

import * as contact from './api.js';

const page = (n) => (n > 1 ? n : '');

export const useDemandesContact = () => useListePaginee(({ page: n, signal }) => contact.miennes({ page: page(n) }, { signal }), []);

export const useDemandesRendu = () => useListePaginee(({ page: n, signal }) => devis.demandes({ page: page(n) }, { signal }), []);
