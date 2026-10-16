// Page où renvoyer le client après connexion (?suite=…), limitée aux chemins internes du site.
export function cheminDeSuite(parametres, parDefaut = '/compte') {
  const suite = parametres.get('suite');
  // Les navigateurs suppriment tabulations et retours à la ligne d'une URL : « /\t/site.com » deviendrait « //site.com ».
  if (!suite || /[\u0000-\u001F\u007F\\]/.test(suite)) return parDefaut;
  if (!suite.startsWith('/') || suite.startsWith('//')) return parDefaut;
  return suite;
}
