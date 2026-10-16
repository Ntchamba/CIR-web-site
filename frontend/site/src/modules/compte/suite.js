// Page où renvoyer le client après connexion (?suite=…), limitée aux chemins internes du site.
export function cheminDeSuite(parametres, parDefaut = '/compte') {
  const suite = parametres.get('suite');
  if (!suite || !suite.startsWith('/') || suite.startsWith('//') || suite.startsWith('/\\')) return parDefaut;
  return suite;
}
