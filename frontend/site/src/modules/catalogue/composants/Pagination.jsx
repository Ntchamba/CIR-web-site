// Pagination numérotée de la maquette : pastilles 1, 2, 3… (page courante en encre) et « Suivant → ». Liens réels
// (adresse ?page=n), « Précédent » ajouté dès la page 2. Rien s'il n'y a qu'une page.
import { Link, useLocation } from 'react-router';

import { useTraduction } from '@/i18n/index.js';

export default function Pagination({ page, pages }) {
  const { t } = useTraduction();
  const { pathname, search } = useLocation();
  if (pages <= 1) return null;
  const vers = (n) => {
    const p = new URLSearchParams(search);
    if (n > 1) p.set('page', String(n));
    else p.delete('page');
    const texte = p.toString();
    return `${pathname}${texte ? `?${texte}` : ''}`;
  };
  return (
    <nav className="m-pagination" aria-label={t('catalogue.pagination.titre')}>
      {page > 1 && <Link to={vers(page - 1)} rel="prev">{t('catalogue.pagination.precedent')}</Link>}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link key={n} to={vers(n)} aria-current={n === page ? 'page' : undefined}
          aria-label={t('catalogue.pagination.page', { n })}>{n}</Link>
      ))}
      {page < pages && <Link to={vers(page + 1)} rel="next" className="suivant">{t('catalogue.pagination.suivant')}</Link>}
    </nav>
  );
}
