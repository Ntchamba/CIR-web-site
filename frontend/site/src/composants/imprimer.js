// Impression d'un seul bloc de la page (devis, contrat) : la feuille de style d'impression
// (styles/global.css) masque tout sauf l'élément marqué `.impression-cible`.
export function imprimerElement(element) {
  if (!element || typeof window.print !== 'function') return;
  element.classList.add('impression-cible');
  document.body.dataset.impression = 'oui';
  const nettoyer = () => {
    element.classList.remove('impression-cible');
    delete document.body.dataset.impression;
    window.removeEventListener('afterprint', nettoyer);
  };
  window.addEventListener('afterprint', nettoyer);
  window.print();
  // Certains navigateurs n'envoient pas « afterprint » : l'appel à print() est bloquant, on nettoie ensuite.
  nettoyer();
}
