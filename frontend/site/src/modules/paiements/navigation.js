// Redirection vers la page de paiement de CamPay (isolée pour être simulée dans les tests).
/** Seules les adresses https:// (ou http://localhost en développement) sont suivies. */
export function adresseSure(adresse) {
  try {
    const url = new URL(String(adresse));
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function rediriger(adresse) {
  if (adresseSure(adresse)) window.location.assign(adresse);
}
