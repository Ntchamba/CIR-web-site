// Le lien d'une notification vient du serveur : seul un chemin du site est suivi (jamais une adresse externe).
export function cheminSur(lien, repli = '/notifications') {
  if (typeof lien !== 'string') return repli;
  if (!lien.startsWith('/') || lien.startsWith('//') || lien.includes('\\')) return repli;
  return lien;
}
