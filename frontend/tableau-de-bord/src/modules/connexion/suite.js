// Page où revenir après la connexion (?suite=…). Seuls les chemins internes sont acceptés.
export function cheminDeSuite(parametres) {
  const suite = parametres?.get?.('suite') || '';
  if (!suite.startsWith('/') || suite.startsWith('//') || suite.startsWith('/\\') || suite.startsWith('/connexion')) {
    return '/';
  }
  return suite;
}
