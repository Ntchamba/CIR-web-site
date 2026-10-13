// Vrai quand la page a défilé au-delà du seuil (l'en-tête transparent devient opaque).
import { useEffect, useState } from 'react';

export default function useDefilement(seuil = 60) {
  const [depasse, setDepasse] = useState(() => typeof window !== 'undefined' && window.scrollY > seuil);
  useEffect(() => {
    const surDefilement = () => setDepasse(window.scrollY > seuil);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, [seuil]);
  return depasse;
}
