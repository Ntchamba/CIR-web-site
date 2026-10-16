// Langues de la plateforme CIR (décision du 16 octobre 2026, docs/decisions/README.md, fiche 7).
// Le français est la langue de référence : tout texte existe d'abord en français, et sert de secours
// si une traduction manque.
//   code : code court utilisé partout (fichiers de messages, stockage, paramètre ?lang=)
//   intl : locale des formats de nombres et de dates (Intl)
//   html : attribut lang de la page
//   api  : valeur envoyée au back-end dans Accept-Language (codes Django : zh-hans)
export const LANGUES = [
  { code: 'fr', nom: 'Français', intl: 'fr-FR', html: 'fr', api: 'fr' },
  { code: 'en', nom: 'English', intl: 'en-GB', html: 'en', api: 'en' },
  { code: 'zh', nom: '中文', intl: 'zh-CN', html: 'zh-Hans', api: 'zh-hans' },
  { code: 'de', nom: 'Deutsch', intl: 'de-DE', html: 'de', api: 'de' },
  { code: 'ja', nom: '日本語', intl: 'ja-JP', html: 'ja', api: 'ja' },
];

export const LANGUE_PAR_DEFAUT = 'fr';
export const CODES_LANGUES = LANGUES.map((l) => l.code);

/** Fiche d'une langue (celle du français si le code est inconnu). */
export function infosLangue(code) {
  return LANGUES.find((l) => l.code === code) || LANGUES[0];
}

/**
 * Code de langue géré correspondant à une étiquette quelconque (« en-US », « zh-Hans-CN », « DE »),
 * ou null si la langue n'est pas proposée.
 */
export function langueGeree(etiquette) {
  if (!etiquette || typeof etiquette !== 'string') return null;
  const base = etiquette.trim().toLowerCase().replace('_', '-').split('-')[0];
  return CODES_LANGUES.includes(base) ? base : null;
}
