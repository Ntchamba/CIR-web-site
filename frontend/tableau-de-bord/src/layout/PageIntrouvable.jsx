// Page 404 du tableau de bord.
import { Link } from 'react-router';

import Bouton from '@partage/ui/Bouton.jsx';
import EtatVide from '@partage/ui/EtatVide.jsx';
import usePageMeta from '@partage/utils/usePageMeta.js';

import { useTraduction } from '@/i18n/index.js';

export default function PageIntrouvable() {
  const { t } = useTraduction();
  usePageMeta(t('introuvable.meta'));
  return (
    <EtatVide titre={t('introuvable.titre')} niveau={1}
      action={<Bouton as={Link} to="/">{t('introuvable.retour')}</Bouton>}>
      {t('introuvable.texte')}
    </EtatVide>
  );
}
