// Page où revenir après la connexion (?suite=…). Seuls les chemins internes sont acceptés.
export function cheminDeSuite(parametres) {
  const suite = parametres?.get?.('suite') || '';
  // Les navigateurs suppriment tabulations et retours à la ligne d'une URL : « /\t/site.com » deviendrait « //site.com ».
  if (!suite || /[\u0000-\u001F\u007F\\]/.test(suite)) return '/';
  if (!suite.startsWith('/') || suite.startsWith('//') || suite.startsWith('/connexion')) return '/';
  return suite;
}
