// Titre et description de chaque page, pour les moteurs de recherche et les onglets (BNF-10).
import { useEffect } from 'react';

const SUFFIXE = ' | CIR, sols en résine époxy';

export default function usePageMeta(titre, description) {
  useEffect(() => {
    document.title = titre ? titre + SUFFIXE : 'CIR : revêtements de sol en résine époxy à Douala';
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    }
  }, [titre, description]);
}
